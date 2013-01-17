# Hutimility

A source code transformation tool that translates "html literals" into real JS.

In a nutshell; this project uses ZeParser 2 (with html literal support) to parse input source code. It then goes through the results of the parser and translates all html tags to the actual JS code that would generate the intended html (using DOM api's).

This project requires my (ZeParser 2)[http://github.com/qfox/zeparser2] project on the `html` branch (!).

## Example

```js
...
document.body.appendChild(
  <div @container style="border: 1px solid red; margin: 5px;">
    <p>Please fill out this form:</p>
    <p><label>Name: <input @name style="width:100px;" /></label></p>
    <p><label>Title: <input @title style="width:100px;" /></label></p>
  </div>
);
this.container = container;
name.onkeyup = function(){ this.name = name.value; };
title.onkeyup = function(){ this.name = name.value; };
...
```

If you would give the above to `translate`, this would be the result:

```js
document.body.appendChild(
  (function(){
	var dom = document.createElement('div');
	dom.setAttribute('style', 'border: 1px solid red; margin: 5px;');
	dom.appendChild(document.createTextNode('\n    '));
	dom.appendChild((function(){
		var dom = document.createElement('p');
		dom.appendChild(document.createTextNode('Please fill out this form:'));
	})());
	dom.appendChild(document.createTextNode('\n    '));
	dom.appendChild((function(){
		var dom = document.createElement('p');
		dom.appendChild((function(){
			var dom = document.createElement('label');
			dom.appendChild(document.createTextNode('Name: '));
			dom.appendChild((function(){
				var dom = document.createElement('input');
				dom.setAttribute('style', 'width:100px;');
			})());
		})());
	})());
	dom.appendChild(document.createTextNode('\n    '));
	dom.appendChild((function(){
		var dom = document.createElement('p');
		dom.appendChild((function(){
			var dom = document.createElement('label');
			dom.appendChild(document.createTextNode('Title: '));
			dom.appendChild((function(){
				var dom = document.createElement('input');
				dom.setAttribute('style', 'width:100px;');
			})());
		})());
	})());
	dom.appendChild(document.createTextNode('\n  '));
})()
);
this.container = container;
name.onkeyup = function(){ this.name = name.value; };
title.onkeyup = function(){ this.name = name.value; }; test.html:47
```

Which, as you can see, is fairly clean code, though very, very verbose.

Because of the multiple calls to `setAttribute` and/or `appendChild`, the code has to be wrapped in an anonymous function to prevent scope polution for the temporary variables (it's not like it would be cleaner otherwise...).

Note that the `@name` assignment syntax is not yet working. It's actually not that trivial to properly rewrite code for that one.

So yeah. Good luck :)

## Name

My working dirname was `htmllit`, but every time I saw it I kind of read "humility". And then I wanted to be witty, so that's why I went for HuTiMiLityy... ;)

## todos

* Make the `@name` variable assignment work.
* Generate sourcemap
* Add more integration tests
