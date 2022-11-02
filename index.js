const fs = require("fs")
const path = require("path")
const sdir = require("serve-static")

function getArgs(func) {
	if (!func) return []
	const ARROW = true
	const FUNC_ARGS = ARROW ? /^(function)?\s*[^\(]*\(\s*([^\)]*)\)/m : /^(function)\s*[^\(]*\(\s*([^\)]*)\)/m
	const FUNC_ARG_SPLIT = /,/
	const FUNC_ARG = /^\s*(_?)(.+?)\1\s*$/
	const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm
	const ENCLOSED = /^(async)?\s*\(.*\)$/
	const UNENCLOSEDASYNC = /^(async)?\s+(.*)$/

	const funcStr = func.toString().replace(STRIP_COMMENTS, "")
	const funcArg = funcStr.split("=>")[0].trim()
	const funcRest = funcStr.split("=>")[1].trim()
	const funcStrEnclosed = funcArg.match(ENCLOSED)
		? funcStr
		: funcArg.match(UNENCLOSEDASYNC)
		? `async (${funcArg.replace("async", "").trim()}) => ${funcRest}`
		: `(${funcArg}) => ${funcRest}`

	return (funcStrEnclosed.match(FUNC_ARGS) || ["", "", ""])[2]
		.split(FUNC_ARG_SPLIT)
		.map(function (arg) {
			return arg.replace(FUNC_ARG, function (all, underscore, name) {
				return name.split("=")[0].trim()
			})
		})
		.filter(String)
}

function mapCookies(cookie) {
	if (typeof cookie !== "string") return {}
	let cookieArray = cookie.split(";")
	let cookieObj = { body: {} }
	cookieArray.forEach(item => {
		try {
			let _item = item.split("=")
			let key = decodeURIComponent(_item[0].trim())
			let val = _item[1] ? decodeURIComponent(_item[1].trim()) : null
			cookieObj.body[key] = val
		} catch (_) {
			console.log("Error decoding cookie: " + item)
		}
	})
	return cookieObj
}

const initHandlers = (rpcParentDir = null) => {
	let rpcSubPath = rpcParentDir ? path.join(rpcParentDir, "rpc") : "rpc"
	let dir = path.join(process.cwd(), rpcSubPath)
	let modules = fs.existsSync(dir) ? fs.readdirSync(dir, (err, files) => (err ? files : [])) : []
	let arr = []
	modules = modules.filter(file => file.endsWith(".js"))
	modules.map(module => {
		let rname =
			module.match(/.*(?=\.js)/g)[0] ||
			(() => {
				return
			})()
		let funcs = require(path.join(dir, module))
		Object.keys(funcs).forEach(func => {
			const params = getArgs(funcs[func])
			const fitPayload = payload => {
				let arr = params.map((item, index) => {
					if (item === "Cookies") return cookieHandlerStore(mapCookies(payload?.cookies))
					if (payload?.params[index]) return payload?.params[index] ?? null
				})
				return arr
			}
			arr.push({
				name: `${rname}.${func}`,
				params: params,
				run: async (payload, callback) => {
					let outcome = await funcs[func](
						...fitPayload(payload)
						// { cookies__: mapCookies(payload?.cookies) }
					)
					if (callback && outcome !== undefined) callback(outcome)
				}
			})
		})
	})
	return arr
}

let cookieHandlerStore = param => param
const cookieHandler = middleware => (cookieHandlerStore = middleware)

var handlers = initHandlers()

const io = socket => {
	if (typeof socket === "string") return handlers
	console.log("User connected to Sockets.IO")
	handlers.forEach(handler => socket.on(handler.name, (payload, callback) => handler.run(payload, callback)))
	socket.on("disconnect", () => {
		console.log("User disconnected from Sockets.IO")
	})
}

const _interface = (fname, window = true) => {
	if (typeof fname !== "string" || !fname.endsWith(".js")) return ""
	let rpcn = fname.substring(0, fname.length - 3)
	let template = {
		start: [`import '/rpc/socket_io/socket.io.js'`, `var socket = io();`, `var functions = {};`],
		inner: handlers
			.map(route => {
				if (!route.name.startsWith(rpcn + ".", "")) return null
				return `functions.${route.name.replace(rpcn + ".", "")} = (${route.params.join(
					", "
				)}) => new Promise( resolver => { socket.emit('${route.name}', {cookies: document.cookie, params:[${route.params.join(
					", "
				)}]}, response => resolver(response) ) });`
			})
			.filter(item => item !== null),
		end: [
			window ? `window.rpc = window.rpc ? {...window.rpc, ${rpcn}: functions} : {${rpcn}: functions}` : null,
			`export default { ...functions }`
		]
	}
	let contents = [...template.start, ...template.inner, ...template.end].join("\n")
	return contents
}

const express = app => {
	app.get("/rpc/:rpc_file", (req, res, next) => {
		let rpcf = req.params.rpc_file
		let contents = _interface(rpcf)
		res.type("application/javascript")
		res.write(contents)
		res.end()
	})
	app.use("/rpc/socket_io", sdir(path.join(process.cwd(), "node_modules/socket.io/client-dist")))
}

const init = (server, dir) => {
	if (dir) {
		handlers = initHandlers(dir)
	}
	var SocketIO = require("socket.io")
	var socketIO = new SocketIO.Server(server)
	socketIO.on("connection", socket => io(socket))
	return true
}

handlers.map(handler => console.info(`Mounted RPC Route: ${handler.name}`))

module.exports = { express, init, interface: _interface, cookieHandler }