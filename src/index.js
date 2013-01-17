/**
 * Parse input with zeparser2, rewrite html literals to proper (DOM api) js
 */
function translate(input){
  // take apart
  var par = new Par(input);
  par.run();
  var tokens = par.tok.tokens;

  // reconstruct
  return tokens.map(function(token){
    if (token.type !== HTML) return token.value;
    return reviveTag(token.root);
  }).join('');
}

function reviveTag(tag, _depth){
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
        else if (child.type === 'tag') str += prefix2+'dom.appendChild('+reviveTag(child.tag, (_depth|0)+1)+');\n';
        else if (child.type === 'dynamic') {
          str +=
            prefix2+'var value = function(){ return '+child.value+'; }();\n' +
            prefix2+'if (typeof value === \'object\' && value !== null) dom.appendChild(result);\n' +
            prefix2+'else if (typeof value !== \'\') dom.appendChild(document.createTextNode(String(result).replace(/\'/g,\'\\\\\\\'\').replace(/\\n/g,\'\\\\n\')));\n' +
          '';
        }
      });
    }

    str += prefix2+'return dom;\n';

    str += prefix+'})()';
  }

  return str;
}
