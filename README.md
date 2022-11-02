[![](https://jsongoku.com/img/noRPC.png)](#)

[![GitHub](https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white)](https://github.com/emmyarty/norpc)
[![NPM](https://img.shields.io/badge/NPM-%23000000.svg?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/norpc)

[![StackBlitz](https://img.shields.io/badge/Live%20Demo-Click%20Here!-orange)](https://stackblitz.com/edit/norpc?file=index.js)

[![GitHub license](https://img.shields.io/github/license/Naereen/StrapDown.js.svg)](https://github.com/emmyarty/norpc/blob/main/LICENSE)
[![made-with-javascript](https://img.shields.io/badge/Made%20with-JavaScript-1f425f.svg)](#)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](#)
[![Maintainer](https://img.shields.io/badge/maintainer-emmyarty-blue)](#)

# noRPC
Seamless RPC server &amp; client with autocomplete and dynamically generated stub scripts to safely expose back-end functions to the front-end!
Powered by Sockets.io, with no external dependencies.
```
npm i norpc
```
[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/emmyarty)
## What's an RPC?

Think of a 'remote procedure call' as a way of allowing users to call functions on a server without having direct access to its innards.

Say you want to use JS on the front-end to change a password, and you didn't want to go through the hassle of building forms, formatting fetch request, resolving the response and then doing something with it. You might wish that changing the password was as easy as:
```js
let newPassword = document.querySelector('#passwordInput').value

// Gets the server to change the password and then outputs the success to the browser's console
user.changePassword(newPassword)
  .then(response => console.log(response))
```
## Using Node & Express
If you are using this with Node & Express, getting this up and running is easy as can be. If you've used express-generator, place this beneath the server declaration within **/bin/www**:
```js
// ./bin/www

// Create noRPC's Socket.io server.
const rpc = require('norpc')
rpc.init(server)
```
And then inside **app.js**:
```js
// ./app.js

// Use Express to serve the client files including the Socket.io static files
const rpc = require('norpc')
rpc.express(app)

// Use middleware to process the Cookies object which will be passed into functions which
// include 'Cookies' as a parameter. You do NOT need to pass this in manually when making
// your RPC calls, so make sure to defined Cookies as the last parameter (or insert nulls)
rpc.cookieHandler(cookies => {
    cookies.loggedIn = (cookies.body?.jwt === 'madeuptokenabc123')
    return cookies
})
```
The module can be required in the header if you prefer, but **rpc.express(app)** must of course be called *after* the app instance has been initialised. When calling **rpc.init(...)**, you can pass a string as the second parameter to set a different root path for the rpc files relative to the working directory.

**If you are not using Express**, you can still use this lib but you need to serve the static files yourself some other way. To generate the content of the dynamic JS files, pass the name of the script to **rpc.interface(scriptName [string])**.

The client files are served at **/rpc/\<file\>.js** on the front-end, and the Socket.io static files are served at **/rpc/socket_io/\<file\>.js** - don't forget this step!

## Building Your RPC Function Libraries
Okay, so now that you're set up, let's go ahead and actually use the library.

Create a folder called **rpc** in your current working directory (aka the 'app root' folder, typically housing **package.json**), and create a JS file here.
#### ⚠️ FILENAMES WITHIN THE RPC FOLDER MUST BE BOTH URL-SAFE AND VALID JS VARIABLE NAMES
Each JS file here will become your own individual RPC library and the name of the file will become its library name. You can refer to pre-parsed cookies within these functions by accessing COOKIES. No support for middleware as such (cautious about convoluting the library), but you can deal with authentication within a guard clause to achieve the same goal for the most part.
Now we create the functions we want to expose!
```js
// ./rpc/example.js

var rpc = {}

rpc.hello = () => {
    return 'World!'
}

rpc.doubled = (val) => {
    return val * 2
}

rpc.reply = (name) => {
    return 'Hi ' + name + '!'
}

// Here we define Cookies as the last (only) parameter. We don't need to worry about it when
// calling it from the front-end, the library will insert it after processing the cookies
// with the optional middleware
rpc.chickens = async (Cookies) => {
    if (!Cookies.loggedIn) return 'Nobody here but us chickens.'
    return 'The chickens are a lie.'
}

module.exports = rpc
```
## Consuming Your RPC
Finally, all that's left to do is to consume them. Remember that everything is async and needs to be handled using promises / awaits. If you have a **/public** folder containing the front-end script **myScript.js**, you might do this:
```js
// ./public/javascripts/myScript.js

import example from '../../rpc/example.js'

let myNumber = 5
let myNumberTimeTwo = await example.doubled(myNumber);

console.log(myNumberTimeTwo) // Outputs 10
```
You might notice you have full access to autocomplete as you call the functions! It certainly makes life easier, in my opinion; Sockets.io glues binds this all together using **emit**s, and that **rpc.express(server)** we inserted earlier deals with ensuring JS files are available on the front-end which mirror the names and parameters of the back-end calls.
That's how this works without ever *actually* giving access to your back-end files to the client.