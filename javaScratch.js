const WebSocket = require("ws")
const xml2js = require("xml2js")
const crypto = require("crypto")

function Session(username, password, options) {

    async function getCSRF(setVars) {
        const request = fetch("https://scratch.mit.edu/csrf_token/")
        if (setVars) request.then(res => {
            const csrf = res.headers.get("set-cookie").split("scratchcsrftoken=")[1].split(";")[0]
            headers["Cookie"] = `scratchcsrftoken=${csrf};`
            headers["X-CSRFToken"] = csrf
            context.csrfToken = csrf
        })
        return await request
    }

    function getXmlHeaders(data) {
        const head = {...headers}
        head["Accept"] = "text/html, */*; q=0.01"
        if (data) head["Content-Length"] = JSON.stringify(data).length.toString()
        head["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"
        return head
    }

    const defaultUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0"

    const userAgent = options?(options.userAgent || defaultUserAgent) : defaultUserAgent

    const headers = {
        "referer": "https://scratch.mit.edu/",
        "User-Agent": userAgent,
        "Accept": "application/json",
        "Accept-Language": "en-GB,en;q=0.5",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "X-Token": "",
        "Cookie": ""
    }

    const context = this

    context.csrfToken = null
    context.xToken = null
    context.sessionId = null

    context.password = password
    context.username = username

    context.loginStatus = false

    context.xmlParser = {
        profileComments: data => {
            const parser = new xml2js.Parser(() => {
            })
            const comments = []
            parser.parseString("<?xml version=\"1.0\" encoding=\"utf-8\"?><root>" + data + "</root>", (error, output) => {
                output.root.li.forEach(i => {
                    const comment = {}
                    comment.id = i.div[0].$.id.split("-")[1]
                    comment.authorString = i.div[0].div[1].div[0].a[0]._
                    comment.content = i.div[0].div[1].div[1]._.trim()
                    comment.replies = []
                    if (i.ul[0].li) i.ul[0].li.forEach(j => {
                        const reply = {}
                        reply.id = j.div[0].$.id.split("-")[1]
                        reply.authorString = j.div[0].div[1].div[0].a[0]._
                        reply.content = j.div[0].div[1].div[1]._.trim()
                        comment.replies.push(reply)
                    })
                    comments.push(comment)
                })

            })
            return comments
        },
        profileActivity: data => {
            const parser = new xml2js.Parser(() => {
            })
            const items = []
            parser.parseString("<?xml version=\"1.0\" encoding=\"utf-8\"?><root>" + data + "</root>", (error, output) => {
                output.root.ul[0].li.forEach(i => {
                    const item = {}
                    item.action = i.div[0]._.trim().replaceAll("\n", "").replaceAll(/ +/g, " ")
                    item.actor = i.div[0].span[0]._ ?? i.div[0].span[0].a[0]._
                    item.time = i.div[0].span[1]._.trim()
                    item.targets = i.div[0].a.map(x => "https://scratch.mit.edu" + x.$.href)
                    items.push(item)
                })

            })
            return items
        },
        profileFeatured: data => {
            const parser = new xml2js.Parser(() => {
            })
            let out
            const toParse = "<?xml version=\"1.0\" encoding=\"utf-8\"?><root>" + data.replaceAll(/<iframe.*>.*<\/iframe>/g, "").replace("<!DOCTYPE html>", "").split(/(?<=<body.*)>/, 2)[1].replace("</body>", "").replace("</html>", "").replace("class=\"search\"", "").replaceAll(/<input.*>/g, "").replaceAll(/<form method="post" id="login".*>/g, "").replaceAll(/<div id="topnav" >(.|\n)*?<\/div>(.|\n)*?<\/div>(.|\n)*?<\/div>(.|\n)*?<\/div>/g, "").replaceAll(/<img.*?>/g, "").replace(/<select.*>(.|\n)*?<\/select>/g, "").replaceAll("<%- count %>", "").replace(/<script type="text\/template" id="template-comment-actions">(.|\n)*?<\/script>/g, "").replace(/<script type="text\/template" id="template-project-collection">(.|\n)*?<\/script>/g, "").replaceAll("<%- comment_id %>", "").replaceAll("<%- thread_id %>", "").replaceAll("<%- commentee_id %>", "").replace(/<button class="btn blue btn-primary" data-control="save">.*<\/button>(.|\n)*?<\/div>(.|\n)*?<\/div>/g, "<button class=\"btn blue btn-primary\" data-control=\"save\">replaced due to XML error (JavaScratch error)</button></div>").replaceAll("<br>", "").replace("&& today.getMonth() === 3)", "") + "</root>"
            parser.parseString(toParse, (error, output) => {
                out = {
                    id: output.root.div[0].div[3].div[1].div[1].div[1].div[0].div[1].div[0].a[0].$.href.split("/")[2],
                    label: output.root.div[0].div[3].div[1].div[1].div[1].div[0].div[1].h3[0]._
                }

            })
            return out
        },
        collections: data => {
            const parser = new xml2js.Parser(() => {
            })
            const out = []
            let toParse = "<?xml version=\"1.0\" encoding=\"utf-8\"?><root>" + data.replaceAll(/<iframe.*>.*<\/iframe>/g, "").replace("<!DOCTYPE html>", "").split(/(?<=<body.*)>/, 2)[1].replace("</body>", "").replace("</html>", "").replace("class=\"search\"", "").replaceAll(/<input.*>/g, "").replaceAll(/<form method="post" id="login".*>/g, "").replaceAll(/<div id="topnav" >(.|\n)*?<\/div>(.|\n)*?<\/div>(.|\n)*?<\/div>(.|\n)*?<\/div>/g, "").replaceAll(/<img.*?>/g, "").replace(/<select.*>(.|\n)*?<\/select>/g, "").replaceAll("<%- count %>", "").replace(/<script.*>(.|\n)*?<\/script>/g, "").replaceAll("<%- comment_id %>", "").replaceAll("<%- thread_id %>", "").replaceAll("<%- commentee_id %>", "").replace(/<button class="btn blue btn-primary" data-control="save">.*<\/button>(.|\n)*?<\/div>(.|\n)*?<\/div>/g, "<button class=\"btn blue btn-primary\" data-control=\"save\">replaced due to XML error (JavaScratch error)</button></div>").replaceAll("<br>", "").replace("&& today.getMonth() === 3)", "").replace("&raquo;", "")
            toParse += toParse.includes("Shared Projects (") ? "</div></div></fieldset></form></div></root>" : "</root>"
            parser.parseString(toParse, (error, output) => {
                output.root.div[0].div[3].div[1].div[1].div[0].ul[0].li.forEach(i => {
                    out.push(i.li[0].a[0].$.href)
                })
            })
            return out
        }
    }

    context.onReady = () => {
        console.log("Success.")
        console.log("\x1b[2mThis message/callback function can be changed. Set this function at session.onReady")
    }

    context.onFail = (message) => {
        console.log("Error: " + message)
        console.log("\x1b[2mThis message/callback function can be changed. Set this function at session.onFail")
    }

    context.initialize = () => {
        if (!context.initialized) {
            getCSRF(true).then(r => {
                if (r.status === 200) {
                    fetch("https://scratch.mit.edu/accounts/login/", {
                        "credentials": "include",
                        headers,
                        "referrer": "https://scratch.mit.edu/",
                        "body": "{\"username\":\"" + context.username + "\",\"password\":\"" + context.password + "\",\"useMessages\":true}",
                        "method": "POST",
                        "mode": "cors"

                    }).then(response =>
                        response.json().then(res => {
                            const data = res[0]
                            if (data.success === 1 && response.status === 200) {
                                context.initialized = true
                                context.sessionId = response.headers.get("set-cookie").split("scratchsessionsid=")[1].split(";")[0]
                                context.xToken = data.token
                                headers["X-Token"] = context.xToken
                                headers["Cookie"] = `scratchcsrftoken=${context.csrfToken};scratchsessionsid=${context.sessionId};`
                                fetch("https://scratch.mit.edu/session/", {
                                    "credentials": "include",
                                    headers,
                                    "method": "GET",
                                    "mode": "cors",
                                }).then(response => response.json().then(res => {
                                    headers["Cookie"] += `permissions=${encodeURIComponent(JSON.stringify(res.permissions))};`
                                    if (response.status === 200) context.onReady()
                                    else context.onFail("Bad response")
                                }))
                            } else {
                                context.onFail("Bad response")
                            }
                        })
                    )
                }
            })

        } else {
            context.onFail("Already logged in")
        }
    }

    context.end = () => {
        context.initialized = false
        return fetch("https://scratch.mit.edu/accounts/logout/", {
            "credentials": "include",
            headers,
            "referrer": "https://scratch.mit.edu/",
            "method": "POST",
            "mode": "cors"
        })
    }

    context.frontPage = {
        getFrontpaged: () => {
            return fetch("https://scratch.mit.edu/proxy/featured/", {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        },
        getNews: (offset, limit) => {
            return fetch("https://api.scratch.mit.edu/news?limit=" + limit, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }
    }

    context.Project = function (projectId) {
        const projectContext = this

        Object.defineProperty(projectContext, "id", {
            value: projectId,
            writable: false,
            enumerable: true
        })

        projectContext.id = projectId

        projectContext.setData = data => {
            return fetch(`https://projects.scratch.mit.edu/${projectContext.id}`, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "body": JSON.stringify(data),
                "method": "PUT",
                "mode": "cors"
            })
        }

        projectContext.setThumbnail = pngString => {
            return fetch("https://scratch.mit.edu/internalapi/project/thumbnail/" + projectContext.id + "/set/", {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/projects/" + projectContext.id + "/editor",
                "body": pngString,
                "method": "POST",
                "mode": "cors"
            });
        }

        projectContext.getMeta = () => {
            return fetch(`https://api.scratch.mit.edu/projects/${projectContext.id}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        projectContext.getRemixes = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/projects/${projectContext.id}/remixes?offset=${offset}&limit=${limit}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        projectContext.getStudios = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/projects/${projectContext.id}/studios?offset=${offset}&limit=${limit}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        projectContext.getComments = (offset, limit) => {
            return projectContext.getMeta().then(projectInformationRaw => projectInformationRaw.json().then(projectInformation => {
                const user = projectInformation.author.username
                return fetch(`https://api.scratch.mit.edu/users/${user}/projects/${projectContext.id}/comments?offset=${offset}&limit=${limit}`, {
                        "credentials": "omit",
                        headers,
                        "referrer": "https://scratch.mit.edu/",
                        "method": "GET",
                        "mode": "cors"
                    }
                )
            }))
        }

        projectContext.getCommentReplies = (offset, limit, commentId) => {
            return projectContext.getMeta().then(projectInformationRaw => projectInformationRaw.json().then(projectInformation => {
                const user = projectInformation.author.username
                return fetch(`https://api.scratch.mit.edu/users/${user}/projects/${projectContext.id}/comments/${commentId}/replies?offset=${offset}&limit=${limit}`, {
                        "credentials": "omit",
                        headers,
                        "referrer": "https://scratch.mit.edu/",
                        "method": "GET",
                        "mode": "cors"
                    }
                )
            }))
        }

        projectContext.getData = () => {
            return projectContext.getMeta().then(projectInformationRaw => projectInformationRaw.json().then(projectInformation => {
                const token = projectInformation.project_token
                return fetch(`https://projects.scratch.mit.edu/${projectContext.id}?token=${token}`, {
                    "credentials": "omit",
                    headers,
                    "referrer": "https://scratch.mit.edu/",
                    "method": "GET",
                    "mode": "cors"
                })
            }))
        }

        projectContext.removeComment = commentId => {
            return fetch("https://api.scratch.mit.edu/proxy/comments/project/" + projectContext.id + "/comment/" + commentId, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "DELETE",
                "mode": "cors"
            })
        }

        projectContext.postComment = (content, replyOptions) => {
            return fetch("https://api.scratch.mit.edu/proxy/comments/project/" + projectContext.id, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "body": "{\"content\":\"" + content + "\",\"parent_id\":\"" + (replyOptions ? replyOptions.parent : "") + "\",\"commentee_id\":\"" + (replyOptions ? replyOptions.commentee : "") + "\"}",
                "method": "POST",
                "mode": "cors"
            })
        }

        projectContext.postLove = () => {
            return fetch("https://api.scratch.mit.edu/proxy/projects/" + projectContext.id + "/loves/user/" + context.username, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "POST",
                "mode": "cors"
            })
        }

        projectContext.postFavorite = () => {
            return fetch("https://api.scratch.mit.edu/proxy/projects/" + projectContext.id + "/favorites/user/" + context.username, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "POST",
                "mode": "cors"
            })
        }

        projectContext.getCloudLogs = (offset, limit) => {
            return fetch("https://clouddata.scratch.mit.edu/logs?projectid=" + projectContext.id + "&limit=" + limit + "&offset=" + offset, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "POST",
                "mode": "cors"
            })
        }

        projectContext.CloudSocket = function (variablePresets) {

            let cloudSocketContext = this;

            function handleEvent(ev, func) {
                func(ev)
            }

            cloudSocketContext.onOpen = () => {
            }

            cloudSocketContext.onMessage = () => {
            }

            cloudSocketContext.onError = () => {
            }

            cloudSocketContext.onClose = () => {
            }

            cloudSocketContext.onSet = () => {
            }

            cloudSocketContext.onCreate = () => {
            }

            cloudSocketContext.onDelete = () => {
            }

            cloudSocketContext.variables = variablePresets || {}

            cloudSocketContext.close = () => {
                cloudSocketContext.socket.close()
            }

            cloudSocketContext.setVar = (varName, value) => {
                const message = `${JSON.stringify({
                    "method": "set",
                    "user": username,
                    "project_id": projectContext.id,
                    "name": varName,
                    "value": value
                })}\n`
                const data = JSON.parse(message)
                const set = new Event("set")
                set.variable = data.name
                set.value = data.value

                cloudSocketContext.variables[varName] = value
                handleEvent(set, cloudSocketContext.onSet)
                cloudSocketContext.socket.send(message)
            }
            cloudSocketContext.createVar = varName => {
                const message = `${JSON.stringify({
                    "method": "set",
                    "user": username,
                    "project_id": projectContext.id,
                    "name": varName

                })}\n`
                const data = JSON.parse(message)
                const create = new Event("create")
                create.variable = data.name
                cloudSocketContext.variables[varName] = 0
                handleEvent(create, cloudSocketContext.onCreate)
                cloudSocketContext.socket.send(message)
            }
            cloudSocketContext.deleteVar = varName => {
                const message = `${JSON.stringify({
                    "method": "delete",
                    "user": username,
                    "project_id": projectContext.id,
                    "name": varName
                })}\n`
                const data = JSON.parse(message)
                const remove = new Event("delete")
                remove.variable = data.name
                delete cloudSocketContext.variables[varName]
                handleEvent(remove, cloudSocketContext.onDelete)
                cloudSocketContext.socket.send(message)
            }
            cloudSocketContext.connect = () => {
                cloudSocketContext.socket = new WebSocket("wss://clouddata.scratch.mit.edu/", [], {
                    headers: {
                        cookie: "scratchsessionsid=" + context.sessionId + ";",
                        origin: "https://scratch.mit.edu"
                    }
                })
                cloudSocketContext.socket.addEventListener("message", ev => {
                    const data = JSON.parse(ev.data)
                    const set = new Event("set")
                    set.variable = data.name
                    set.value = data.value
                    const create = new Event("create")
                    create.variable = data.name
                    const remove = new Event("delete")
                    remove.variable = data.name
                    switch (data.method) {
                        case "set":
                            cloudSocketContext.variables[data.name] = data.value
                            handleEvent(set, cloudSocketContext.onSet)
                            break
                        case "create":
                            cloudSocketContext.variables[data.name] = 0
                            handleEvent(create, cloudSocketContext.onCreate)
                            break
                        case "delete":
                            delete cloudSocketContext.variables[data.name]
                            handleEvent(remove, cloudSocketContext.onDelete)
                            break
                    }
                    handleEvent(ev, cloudSocketContext.onMessage)
                })
                cloudSocketContext.socket.addEventListener("error", ev => handleEvent(ev, cloudSocketContext.onError))
                cloudSocketContext.socket.addEventListener("close", ev => handleEvent(ev, cloudSocketContext.onClose))
                cloudSocketContext.socket.addEventListener("open", ev => {
                    cloudSocketContext.socket.send(JSON.stringify({
                        name: "handshake",
                        user: context.username,
                        project_id: projectContext.id
                    }) + "\n")
                    handleEvent(ev, cloudSocketContext.onOpen)
                })
            }
        }
    }

    context.Studio = function (studioId) {
        const studioContext = this
        studioContext.id = studioId

        studioContext.setMeta = data => {
            return fetch(`https://scratch.mit.edu/site-api/galleries/all/${studioContext.id}/`, {
                "credentials": "include",
                headers,
                "referrer": `https://scratch.mit.edu/studios/${studioId}`,
                "body": JSON.stringify(data),
                "method": "PUT",
                "mode": "cors"
            })
        }

        studioContext.getMeta = () => {
            return fetch(`https://api.scratch.mit.edu/studios/${studioContext.id}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        studioContext.getComments = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/studios/${studioContext.id}/comments?offset=${offset}&limit=${limit}`, {
                    "credentials": "omit",
                    headers,
                    "referrer": "https://scratch.mit.edu/",
                    "method": "GET",
                    "mode": "cors"
                }
            )
        }

        studioContext.getCommentReplies = (offset, limit, commentId) => {
            return fetch(`https://api.scratch.mit.edu/studios/${studioContext.id}/comments/${commentId}/replies?offset=${offset}&limit=${limit}`, {
                    "credentials": "omit",
                    headers,
                    "referrer": "https://scratch.mit.edu/",
                    "method": "GET",
                    "mode": "cors"
                }
            )
        }

        studioContext.removeComment = commentId => {
            return fetch("https://api.scratch.mit.edu/proxy/comments/studio/" + studioContext.id + "/comment/" + commentId, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "DELETE",
                "mode": "cors"
            })
        }

        studioContext.postComment = (content, replyOptions) => {
            return fetch("https://api.scratch.mit.edu/proxy/comments/studio/" + studioContext.id, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "body": "{\"content\":\"" + content + "\",\"parent_id\":\"" + (replyOptions ? replyOptions.parent : "") + "\",\"commentee_id\":\"" + (replyOptions ? replyOptions.commentee : "") + "\"}",
                "method": "POST",
                "mode": "cors"
            })
        }

        studioContext.getProjects = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/studios/${studioContext.id}/projects/?limit=${limit}&offset=${offset}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        studioContext.getManagers = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/studios/${studioContext.id}/managers/?limit=${limit}&offset=${offset}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        studioContext.getCurators = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/studios/${studioContext.id}/curators/?limit=${limit}&offset=${offset}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        studioContext.getActivity = (limit, dateOffset) => {
            return fetch(`https://api.scratch.mit.edu/studios/${studioContext.id}/activity/?limit=${limit}` + (dateOffset?("&dateLimit=" + dateOffset) : ""), {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        studioContext.postProject = projectId => {
            return fetch(`https://api.scratch.mit.edu/studios/${studioContext.id}/project/${projectId}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "POST",
                "mode": "cors"
            })
        }

        studioContext.removeProject = projectId => {
            return fetch(`https://api.scratch.mit.edu/studios/${studioContext.id}/project/${projectId}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "DELETE",
                "mode": "cors"
            })
        }

        studioContext.inviteUser = name => {
            return fetch(`https://scratch.mit.edu/site-api/users/curators-in/${studioContext.id}/invite_curator/?usernames=${name}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "PUT",
                "mode": "cors"
            })
        }

        studioContext.removeUser = name => {
            return fetch(`https://scratch.mit.edu/site-api/users/curators-in/${studioContext.id}/remove/?usernames=${name}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "PUT",
                "mode": "cors"
            })
        }

        studioContext.promoteUser = name => {
            return fetch(`https://scratch.mit.edu/site-api/users/curators-in/${studioContext.id}/remove/?usernames=${name}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "PUT",
                "mode": "cors"
            })
        }

        studioContext.acceptInvite = () => {
            return fetch(`https://scratch.mit.edu/site-api/users/curators-in/${studioContext.id}/add/?usernames=${name}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "PUT",
                "mode": "cors"
            })
        }

        studioContext.follow = () => {
            return fetch(`https://scratch.mit.edu/site-api/users/bookmarkers/${studioContext.id}/add/?usernames=${context.username}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "PUT",
                "mode": "cors"
            })
        }

        studioContext.unfollow = () => {
            return fetch(`https://scratch.mit.edu/site-api/users/bookmarkers/${studioContext.id}/remove/?usernames=${context.username}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "PUT",
                "mode": "cors"
            })
        }

        studioContext.anyoneCanAdd = anyone => {
            return fetch(`https://scratch.mit.edu/site-api/galleries/${studioContext.id}/mark/${anyone ? "open" : "closed"}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "PUT",
                "mode": "cors"
            })
        }
    }

    context.User = function (name) {
        const userContext = this
        userContext.username = name

        userContext.follow = () => {
            return fetch(`https://scratch.mit.edu/site-api/users/followers/${userContext.username}/add/?usernames=${context.username}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "PUT",
                "mode": "cors"
            })
        }

        userContext.unfollow = () => {
            return fetch(`https://scratch.mit.edu/site-api/users/followers/${userContext.username}/remove/?usernames=${context.username}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "PUT",
                "mode": "cors"
            })
        }

        userContext.getInfo = () => {
            return fetch(`https://api.scratch.mit.edu/users/${userContext.username}`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        userContext.getMessagesCount = () => {
            return fetch(`https://api.scratch.mit.edu/users/${userContext.username}/messages/count`, {
                "credentials": "omit",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        userContext.xmlProfile = {
            getComments: page => {
                return fetch(`https://scratch.mit.edu/site-api/comments/user/${userContext.username}/?page=${page}`, {
                    "credentials": "include",
                    headers,
                    "referrer": "https://scratch.mit.edu/",
                    "method": "GET",
                    "mode": "cors"
                })
            },
            getActivity: limit => {
                return fetch(`https://scratch.mit.edu/messages/ajax/user-activity/?user=${userContext.username}&max=${limit}`, {
                    "credentials": "include",
                    headers,
                    "method": "GET",
                    "mode": "cors"
                })
            },
            getProfile: () => {
                return fetch(`https://scratch.mit.edu/users/${userContext.username}/`, {
                    "credentials": "include",
                    headers,
                    "referrer": "https://scratch.mit.edu/",
                    "method": "GET",
                    "mode": "cors"
                })
            },
            getProjects: (page) => {
                return fetch(`https://scratch.mit.edu/users/${userContext.username}/projects/?page=${page}`, {
                    "credentials": "include",
                    headers,
                    "method": "GET",
                    "mode": "cors"
                })
            },
            getFavorites: (page) => {
                return fetch(`https://scratch.mit.edu/users/${userContext.username}/favorites/?page=${page}`, {
                    "credentials": "include",
                    headers,
                    "method": "GET",
                    "mode": "cors"
                })
            },
            getCuratedStudios: (page) => {
                return fetch(`https://scratch.mit.edu/users/${userContext.username}/studios/?page=${page}`, {
                    "credentials": "include",
                    headers,
                    "method": "GET",
                    "mode": "cors"
                })
            },
            getFollowedStudios: (page) => {
                return fetch(`https://scratch.mit.edu/users/${userContext.username}/studios_following/?page=${page}`, {
                    "credentials": "include",
                    headers,
                    "method": "GET",
                    "mode": "cors"
                })
            },
            getFollowedUsers: (page) => {
                return fetch(`https://scratch.mit.edu/users/${userContext.username}/following/?page=${page}`, {
                    "credentials": "include",
                    headers,
                    "method": "GET",
                    "mode": "cors"
                })
            },
            getFollowingUsers: (page) => {
                return fetch(`https://scratch.mit.edu/users/${userContext.username}/followers/?page=${page}`, {
                    "credentials": "include",
                    headers,
                    "method": "GET",
                    "mode": "cors"
                })
            },
            postComment: (content, replyOptions) => {
                const data = {
                    "commentee_id": replyOptions.commentee ?? "",
                    "content": content,
                    "parent_id": replyOptions.parent ?? ""
                }

                const head = getXmlHeaders(data)

                return fetch(`https://scratch.mit.edu/site-api/comments/user/${userContext.username}/add/`, {
                    "credentials": "include",
                    "headers": {...head},
                    "body": JSON.stringify(data),
                    "method": "POST",
                    "mode": "cors",
                })
            }
        }

        userContext.getSharedProjects = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/users/${userContext.username}/projects?limit=${limit}&offset=${offset}`, {
                "credentials": "include",
                headers,
                "method": "GET",
                "mode": "cors"
            })
        }

        userContext.getFavoriteProjects = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/users/${userContext.username}/favorites?limit=${limit}&offset=${offset}`, {
                "credentials": "include",
                headers,
                "method": "GET",
                "mode": "cors"
            })
        }

        userContext.getFollowing = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/users/${userContext.username}/following?limit=${limit}&offset=${offset}`, {
                "credentials": "include",
                headers,
                "method": "GET",
                "mode": "cors"
            })
        }

        userContext.getFollowers = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/users/${userContext.username}/followers?limit=${limit}&offset=${offset}`, {
                "credentials": "include",
                headers,
                "method": "GET",
                "mode": "cors"
            })
        }

        userContext.getCuratedStudios = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/users/${userContext.username}/studios/curate?limit=${limit}&offset=${offset}`, {
                "credentials": "include",
                headers,
                "method": "GET",
                "mode": "cors"
            })
        }
    }

    context.Self = function () {
        const selfContext = this
        const user = new context.User(context.username)

        selfContext.username = context.username
        selfContext.getInfo = user.getInfo
        selfContext.follow = user.follow
        selfContext.unfollow = user.unfollow
        selfContext.getMessagesCount = user.getMessagesCount
        selfContext.getSharedProjects = user.getSharedProjects
        selfContext.getFavoriteProjects = user.getFavoriteProjects
        selfContext.getFollowing = user.getFollowing
        selfContext.getFollowers = user.getFollowers
        selfContext.getCuratedStudios = user.getCuratedStudios

        selfContext.xmlProfile = user.xmlProfile

        selfContext.xmlProfile.removeComment = commentId => {
            const data = {
                "id": commentId,
            }

            const head = getXmlHeaders(data)

            return fetch(`https://scratch.mit.edu/site-api/comments/user/${context.username}/del/`, {
                "credentials": "include",
                "headers": {...head},
                "body": JSON.stringify(data),
                "method": "POST",
                "mode": "cors"
            })
        }

        selfContext.xmlProfile.toggleComments = () => {
            const head = getXmlHeaders("")
            return fetch(`https://scratch.mit.edu/site-api/comments/user/${context.username}/toggle-comments/`, {
                "credentials": "include",
                "headers": {...head},
                "method": "POST",
                "mode": "cors"
            })
        }

        selfContext.myStuff = {
            getProjects: page => {
                return fetch(`https://scratch.mit.edu/site-api/projects/all/?page=${page}`, {
                    "credentials": "include",
                    headers,
                    "referrer": "https://scratch.mit.edu/",
                    "method": "GET",
                    "mode": "cors"
                })
            },
            getStudios: page => {
                return fetch(`https://scratch.mit.edu/site-api/galleries/all/?page=${page}`, {
                    "credentials": "include",
                    headers,
                    "referrer": "https://scratch.mit.edu/",
                    "method": "GET",
                    "mode": "cors"
                })
            }
        }

        selfContext.getAccountNavJson = () => {
            return fetch("https://scratch.mit.edu/fragment/account-nav.json", {
                "credentials": "include",
                headers,
                "method": "GET",
                "mode": "cors"
            })
        }

        selfContext.getSession = () => {
            return fetch("https://scratch.mit.edu/session/", {
                "credentials": "include",
                headers,
                "method": "GET",
                "mode": "cors"
            })
        }

        selfContext.getMessages = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/users/${context.username}/messages?limit=${limit}}&offset=${offset}`, {
                "credentials": "include",
                headers,
                "method": "GET",
                "mode": "cors",
            })
        }

        selfContext.shareProject = projectId => {
            return fetch(`https://api.scratch.mit.edu/proxy/projects/${projectId}/share`, {
                "credentials": "include",
                headers,
                "method": "PUT",
                "mode": "cors",
            })
        }

        selfContext.unshareProject = projectId => {
            return fetch(`https://api.scratch.mit.edu/proxy/projects/${projectId}/unshare`, {
                "credentials": "include",
                headers,
                "method": "PUT",
                "mode": "cors"
            })
        }

        selfContext.setAsset = (file, extension) => {
            const id = crypto.createHash("md5").update(file).digest("hex")
            return {
                "promise": fetch(`https://assets.scratch.mit.edu/${id}.${extension}`, {
                    "credentials": "omit",
                    headers,
                    "referrer": "https://scratch.mit.edu/",
                    "body": file,
                    "method": "POST",
                    "mode": "cors"
                }),
                id
            }
        }

        selfContext.getActivity = (offset, limit) => {
            console.log(headers)
            return fetch("https://api.scratch.mit.edu/users/" + context.username + "/following/users/activity?limit=" + limit + "&offset=" + offset, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        selfContext.getFollowedStudioProjects = () => {
            return fetch("https://api.scratch.mit.edu/users/" + context.username + "/following/studios/projects", {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        selfContext.getFollowedUserProjects = () => {
            return fetch("https://api.scratch.mit.edu/users/" + context.username + "/following/users/projects", {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        selfContext.getFollowedUserLoves = () => {
            return fetch("https://api.scratch.mit.edu/users/" + context.username + "/following/users/loves", {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        selfContext.getRecentProjects = (offset, limit) => {
            return fetch("https://api.scratch.mit.edu/users/" + context.username + "/projects/recentlyviewed?limit=" + limit + "&offset=" + offset, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "GET",
                "mode": "cors"
            })
        }

        selfContext.createProject = data => {
            return fetch("https://projects.scratch.mit.edu", {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "body": data ? JSON.stringify(data) : '{"targets":[{"isStage":true,"name":"Stage","variables":{"`jEk@4|i[#Fk?(8x)AV.-my variable":["my variable",0]},"lists":{},"broadcasts":{},"blocks":{},"comments":{},"currentCostume":0,"costumes":[{"name":"backdrop1","dataFormat":"svg","assetId":"cd21514d0531fdffb22204e0ec5ed84a","md5ext":"cd21514d0531fdffb22204e0ec5ed84a.svg","rotationCenterX":240,"rotationCenterY":180}],"sounds":[{"name":"pop","assetId":"83a9787d4cb6f3b7632b4ddfebf74367","dataFormat":"wav","format":"","rate":48000,"sampleCount":1124,"md5ext":"83a9787d4cb6f3b7632b4ddfebf74367.wav"}],"volume":100,"layerOrder":0,"tempo":60,"videoTransparency":50,"videoState":"on","textToSpeechLanguage":null},{"isStage":false,"name":"Sprite1","variables":{},"lists":{},"broadcasts":{},"blocks":{},"comments":{},"currentCostume":0,"costumes":[{"name":"costume1","bitmapResolution":1,"dataFormat":"svg","assetId":"bcf454acf82e4504149f7ffe07081dbc","md5ext":"bcf454acf82e4504149f7ffe07081dbc.svg","rotationCenterX":48,"rotationCenterY":50},{"name":"costume2","bitmapResolution":1,"dataFormat":"svg","assetId":"0fb9be3e8397c983338cb71dc84d0b25","md5ext":"0fb9be3e8397c983338cb71dc84d0b25.svg","rotationCenterX":46,"rotationCenterY":53}],"sounds":[{"name":"Meow","assetId":"83c36d806dc92327b9e7049a565c6bff","dataFormat":"wav","format":"","rate":48000,"sampleCount":40682,"md5ext":"83c36d806dc92327b9e7049a565c6bff.wav"}],"volume":100,"layerOrder":1,"visible":true,"x":0,"y":0,"size":100,"direction":90,"draggable":false,"rotationStyle":"all around"}],"monitors":[],"extensions":[],"meta":{"semver":"3.0.0","vm":"1.5.92","agent":"' + userAgent + '"}}',
                "method": "POST",
                "mode": "cors"
            })
        }

        selfContext.createStudio = () => {
            return fetch("https://scratch.mit.edu/studios/create/", {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "method": "POST",
                "mode": "cors"
            })
        }
    }
}

exports.Session = Session