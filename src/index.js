var mask5bit = 0x3f; // b111111 (6bits, LSB)
var continuationBit = 32; // b100000 (the msb of these 6 bits is the continuation bit, for every VLQ chunk)

function Hutimility(){

}
Hutimility.prototype = {

  result: '',
  sourcemap: null,

  run: function(){

  },

  /**
   * Parse input with zeparser2, rewrite html literals to proper (DOM api) js
   *
   * @param {string} input
   * @param {string|boolean} [sourcemapUrl] The path of the sourcemap, or true if it will be immediately appended
   */
  translate: function(input, sourcemapUrl){
    var tokens = this.tokenize(input);

    // reconstruct
    var sourceMap = '';
    var sourceMapProcessedTag = true; // always add one at the start

    var str = '';
    var prevlen = 0;
    var prevCol = 0;
    var prevLine = 0;
    console.log(tokens);
    str += tokens.map(function(token){
      var result = '';
      if (token.type !== HTML) result += token.value
      else result += this.reviveTag(token.root);

      var segment = this.createSegment(prevlen, 0, token.line-prevLine, token.col-prevCol);
      sourceMap += segment;
      prevlen = result.length;
      prevLine = token.line;
      prevCol = token.col;

      if (result.indexOf('\n') >= 0) {
        var jumped = result.split('\n').length;
        sourceMap = sourceMap.slice(0,-1) + Array.call(null, jumped).join(';'); // one semi per line jumped
        prevlen = 0;
      }

      return result;
    },this).join('');

    if (sourcemapUrl) {
      str += '\n//@ sourceMappingURL=';
      if (typeof sourcemapUrl === 'string') str += sourcemapUrl+'\n';
    }

    var sobj = {
      version: 3,
      file: 'dynamic',
      sourceRoot: 'dynamic',
      sources: [],
      names: [],
      mappings: sourceMap,
    };

//    console.log("Source map:", JSON.stringify(sobj));
    this.sourcemap = sobj;
    this.result = str;

    return this;
  },

  tokenize: function(input){
    // take apart
    var par = new Par(input);
    par.run();
    return par.tok.tokens;
  },

/*
 ABCDE

 A: target column
 B: source index
 C: source line
 D: source column
 E: names index

 Each character of a VLQ is base64 encoded:
 base64 encoding: A-Za-z0-9+/
 0   --    63

 63 = 6bit = b111111 = 0x3f = mask

 LSB (the would be number "1") of input becomes the sign of the input, the input is unsigned after that:
 1 decimal is 10 binary, -1 decimal is 11 binary

 a bbbb c
 VLQ[0]:   [0 0000 0]
 a bbbbb
 VLQ[n>0]: [0 00000]

 a: continuation (if 0, it's the most significant part)
 b: actual value of this part
 c: sign


 Each line in target is annotated. Starting with some tag. A tag runs up to next tag, or EOL. It's allowed to not map some part of target (?)
 Each part of the VLQ is base64 encoded



 A  B   C   D  E
 AAgBC -> 0, 0, 32, 16, 1

 line 0, column 0 maps to line 16, column 1, of file 0

 */

  createSegment: function(targetColumn, sourceIndex, sourceLine, sourceColumn) {
    var segment = this.toVLQ(targetColumn)+this.toVLQ(sourceIndex)+this.toVLQ(sourceLine)+this.toVLQ(sourceColumn)+',';
//    console.log(targetColumn, sourceIndex, sourceLine, sourceColumn,'=>',segment);
    return segment;
  },

  /**
   * @param tag
   * @param [_depth]
   * @return {string}
   */
  reviveTag: function(tag, _depth){
    var str = 'document.createElement(\''+tag.tagName.replace(/'/g,'\\\'')+'\')';
    var prefix = Array.call(null,(_depth|0)+1).join('\t');
    var prefix2 = prefix + '\t';

    if (tag.attributes || tag.children) {
      str =
        '(function(){\n' +
          prefix2+'var dom = '+str+';\n';

      if (tag.attributes) {
        tag.attributes.forEach(function(attr){
          if (attr.nameType === 'dynamic') {
            str +=
              prefix2+'var name = function(){ return '+attr.value+'; }();\n' +
                prefix2+'if (name !== \'\') dom.setAttribute(\'\\\'\'+name.replace(/\'/g,\'\\\'\')+\'\\\'\', true);\n';
          } else {
            str += prefix2+'dom.setAttribute(\''+attr.name.replace(/'/g,'\\\'')+'\', ';

            if (attr.valueType === 'none') str += 'true';
            else if (attr.valueType === 'normal') str += '\''+String(attr.value).replace(/'/g,'\\\'')+'\'';
            else str += 'function(){ return '+attr.value+'; }()';

            str += ');\n';
          }
        });
      }

      if (tag.children) {
        tag.children.forEach(function(child){
          if (child.type === 'text') str += prefix2+'dom.appendChild(document.createTextNode(\''+child.value.replace(/'/g,'\\\'').replace(/\n/g,'\\n')+'\'));\n';
          else if (child.type === 'tag') str += prefix2+'dom.appendChild('+this.reviveTag(child.tag, (_depth|0)+1)+');\n';
          else if (child.type === 'dynamic') {
            str +=
              prefix2+'var value = function(){ return '+child.value+'; }();\n' +
                prefix2+'if (typeof value === \'object\' && value !== null) dom.appendChild(result);\n' +
                prefix2+'else if (typeof value !== \'\') dom.appendChild(document.createTextNode(String(result).replace(/\'/g,\'\\\\\\\'\').replace(/\\n/g,\'\\\\n\')));\n' +
                '';
          }
        },this);
      }

      str += prefix2+'return dom;\n';

      str += prefix+'})()';
    }

    return str;
  },

  toV: function(n){
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[n];
  },
  toVLQ: function(n){
    var vlq = '';

    // n must be an integer number (32bit, actually)
    n |= 0;

    // the lsb of the number will become the sign bit, the sign is removed
    // in detail: n>>>0 removes the sign. <<1 makes room for the sign bit.
    // and the last part, | (n<0?1:0), sets the first bit accordingly.
    n = (((n<0?-n:n)>>>0) << 1) | (n < 0 ? 1 : 0);

    // now we chunk this number per 5 bits
    do {
      // get the 5 lsb's, then remove them from the input
      var chunk = n & mask5bit;
      n >>= 5;
      // if there is data left, set coninuation bit (otherwise it'll be zero)
      if (n) chunk |= continuationBit;

      vlq += this.toV(chunk);
    } while (n);

    return vlq;
  },

};

