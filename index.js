const fs = require('fs')
const path = require('path')
const static = require('serve-static')

function getArgs(func) {
    const ARROW = true;
    const FUNC_ARGS = ARROW ? /^(function)?\s*[^\(]*\(\s*([^\)]*)\)/m : /^(function)\s*[^\(]*\(\s*([^\)]*)\)/m;
    const FUNC_ARG_SPLIT = /,/;
    const FUNC_ARG = /^\s*(_?)(.+?)\1\s*$/;
    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

    return ((func || '').toString().replace(STRIP_COMMENTS, '').match(FUNC_ARGS) || ['', '', ''])[2]
        .split(FUNC_ARG_SPLIT)
        .map(function(arg) {
            return arg.replace(FUNC_ARG, function(all, underscore, name) {
                return name.split('=')[0].trim();
            });
        })
        .filter(String);
}

const handlers = (() => {
    let dir = path.join(process.cwd(), 'rpc')
    let modules = fs.existsSync(dir) ? fs.readdirSync(dir, (err, files) => err ? files : []) : []
    let arr = []
    modules = modules.filter(file => (file.endsWith('.js')))
    modules.map(module => {
        let rname = module.match(/.*(?=\.js)/g)[0] || (() => {return})()
        let funcs = require(path.join(path.join(process.cwd(), 'rpc'), module))
        Object.keys(funcs).forEach(func => {
            arr.push({
                name: `${rname}.${func}`,
                params: getArgs(funcs[func]),
                run: async (payload, callback) => { let outcome = await funcs[func](...payload); if(callback && outcome !== undefined) callback(outcome) }
            })
        })
    })
    return arr
}) ()

const io = socket => {
    if (typeof socket === 'string') return handlers
    console.log('User connected to Sockets.IO')
    handlers.forEach(handler => socket.on(handler.name, (payload, callback) => handler.run(payload, callback) ))
    socket.on('disconnect', () => {
        console.log('User disconnected from Sockets.IO')
    })
}

const interface = (fname, window = true) => {
    if (typeof fname !== 'string' || !fname.endsWith('.js')) return ''
    let rpcn = fname.substring(0,fname.length-3)
    let template = {
        start: [
            `import '/rpc/socket_io/socket.io.js'`,
            `var socket = io();`,
            `var functions = {};`
        ],
        inner: handlers.map(route => {
            if (!route.name.startsWith(rpcn + '.', '')) return null
            return `functions.${route.name.replace(rpcn + '.', '')} = (${route.params.join(', ')}) => new Promise( resolver => { socket.emit('${route.name}', [${route.params.join(', ')}], response => resolver(response) ) });`
        }).filter(item => item !== null),
        end: [
            window ? `window.rpc = window.rpc ? {...window.rpc, ${rpcn}: functions} : {${rpcn}: functions}` : null,
            `export default { ...functions }`
        ]
    }
    let contents = [...template.start, ...template.inner, ...template.end].join('\n')
    return contents
}

const express = (app) => {
    app.get('/rpc/:rpc_file', (req, res, next) =>
    {
        let rpcf = req.params.rpc_file
        let contents = interface(rpcf)
        res.type('application/javascript')
        res.write(contents)
        res.end()
    });
    app.use('/rpc/socket_io', static(path.join(process.cwd(), 'node_modules/socket.io/client-dist')) )
}

const init = (server) => {
    var SocketIO = require('socket.io')
    var socketIO = new SocketIO.Server(server)
    socketIO.on('connection', socket => io(socket))
    return true
}

handlers.map(handler => console.info(`Mounted RPC Route: ${handler.name}`))

module.exports = { express, init, interface }