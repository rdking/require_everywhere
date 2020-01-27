# require_everywhere
Did you ever want to use the same module code in more than 1 environment in your application? That's what this package offers. You get to write your modules once with no weird ifs and complications to muck things up. What's the cost? Just 2 extra lines of code per module, and 1 additional line in the main application file.

## Usage
The initiating .html file needs to load require_web with a `<script>` tag. This must be loaded before the first .js module calls require. Node and WebWorker code just needs to load the appropriate "require_xxx.js" before trying to use it. Unless you intend to use the returned Promise objects directly, it's best to put all of your logic in the main module in an asynchronous IIFE.

### Initializing Code
#### The Browser Main Thread case...
```html
<!doctype HTML>
<html>
    <head>
        ...
        <script type="javascript" src="path/to/require_web.js"></script>
        <script type="javascript" src="path/to/your/js/module"></script>
        ...
    </head>
    <body>
        ...
    </body>
</html>
```

#### The WebWorker case...
```js
importScripts("path/to/require_web.js");
(async ()=>{
    //Your module code here
})();
```

#### The NodeJS case...
```js
require = require("path/to/require_node.js");
(async ()=>{
    //Your module code here
})();
```

### Module Code
After that, all that's left is to load what you need and get running. There's 2 approaches to it, but they both do essentially the same thing. 

##### If you're just loading a single file...
```js
let yourModule = await require("path/to/your/module.js");
```

##### If you're loading a group of modules...
```js
let _rGid = Symbol();
require("path/to/your/module1.js", _rGid);
require("path/to/your/module2.js", _rGid);
require("path/to/your/module3.js", _rGid);
require("path/to/your/module4.js", _rGid);
let [mod1, mod2, mod3, mod4] = await require(_rGid);
```

### Explanation
Since this version of require is asynchronous, it's best to use `await` to unwrap the Promise values returned automatically for the single file case. This is made easier for you since all modules are wrapped in an asynchronous function. The group case loads all modules concurrently while processing them in the order they were requested, as soon as it is possible to do so. This means modules requested sooner do not have to wait for modules requested later to be loaded before being processed.

With this approach, modules only need to be written once and can be run anywhere. Hopefully, someone other than myself will find this useful.

