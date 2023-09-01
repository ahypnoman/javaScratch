const WebSocket = require("ws")
const xml2js = require("xml2js")
const crypto = require("crypto")

export default function Session(username, password) {

    async function getCSRF() {
        return await fetch("https://scratch.mit.edu/csrf_token/").then(response => response.headers.get("set-cookie").split("scratchcsrftoken=")[1].split(";")[0])
    }

    function getXmlHeaders(data) {
        const head = {...headers}
        head["Accept"] = "text/html, */*; q=0.01"
        if (data) head["Content-Length"] = JSON.stringify(data).length.toString()
        head["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"
        return head
    }

    const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0"

    const headers = {
        "referer": "https://scratch.mit.edu/",
        "User-Agent": userAgent,
        "Accept": "application/json",
        "Accept-Language": "en-GB,en;q=0.5",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
    }

    const context = this

    context.csrfToken = null
    context.xToken = null
    context.sessionId = null

    context.fail = false
    context.active = false

    context.password = password
    context.username = username

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

    context.initialize = () => {
        if (!context.initialized) {
            return getCSRF().then(csrf => {
                headers["Cookie"] = `scratchcsrftoken=${csrf};`
                headers["X-CSRFToken"] = csrf
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
                        if (data.success === 1) {
                            context.active = true
                            context.initialized = true
                            context.sessionId = response.headers.get("set-cookie").split("scratchsessionsid=")[1].split(";")[0]
                            context.xToken = data.token
                            context.csrfToken = csrf
                            headers["X-CSRFToken"] = context.csrfToken
                            headers["X-Token"] = context.xToken
                            headers["Cookie"] = `scratchcsrftoken=${context.csrfToken};scratchsessionsid=${context.sessionId};`
                            fetch("https://scratch.mit.edu/session/", {
                                "credentials": "include",
                                headers,
                                "method": "GET",
                                "mode": "cors",
                            }).then(response => response.json().then(res => {
                                headers["Cookie"] += `permissions=${encodeURIComponent(JSON.stringify(res.permissions))};`
                            }))
                        } else {
                            return false
                        }
                    })
                )

            })
        } else {
            return false
        }
    }

    context.end = () => {
        return fetch("https://scratch.mit.edu/accounts/logout/", {
            "credentials": "include",
            headers,
            "referrer": "https://scratch.mit.edu/",
            "method": "POST",
            "mode": "cors"
        })
    }

    context.setAsset = (file, extension) => {
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

    context.Project = function (projectId) {
        const projectContext = this
        projectContext.id = projectId

        projectContext.setData = data => {
            return fetch(`https://projects.scratch.mit.edu/${projectContext.id}`, {
                "credentials": "include",
                headers,
                "referrer": "https://scratch.mit.edu/",
                "body": data,
                "method": "PUT",
                "mode": "cors"
            })
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

        projectContext.getCommentReplies = (commentId, offset, limit) => {
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
                "body": "{\"content\":\"" + content + "\",\"parent_id\":\"" + (replyOptions ? replyOptions.parent : "") + "\",\"commentee_id\":\"" + (replyOptions ? replyOptions.comentee : "") + "\"}",
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
            cloudSocketContext.connect()
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
                "body": data,
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

        studioContext.getCommentReplies = (commentId, offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/studios/${studioContext.id}/comments/${commentId}/replies?offset=${offset}&limit=${limit}`, {
                    "credentials": "omit",
                    headers,
                    "referrer": "https://scratch.mit.edu/",
                    "method": "GET",
                    "mode": "cors"
                }
            )
        }

        studioContext.deleteComment = commentId => {
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
                "body": "{\"content\":\"" + content + "\",\"parent_id\":\"" + (replyOptions ? replyOptions.parent : "") + "\",\"commentee_id\":\"" + (replyOptions ? replyOptions.comentee : "") + "\"}",
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

        studioContext.getActivity = limit => {
            return fetch(`https://api.scratch.mit.edu/studios/${studioContext.id}/activity/?limit=${limit}`, {
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

    }
    context.self = function () {
        const sContext = this
        const user = new context.User(context.username)

        sContext.getInfo = user.getInfo
        sContext.follow = user.follow
        sContext.unfollow = user.unfollow
        sContext.getMessagesCount = user.getMessagesCount

        sContext.xmlProfile = user.xmlProfile

        sContext.xmlProfile.removeComment = commentId => {
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

        sContext.xmlProfile.toggleComments = () => {
            const head = getXmlHeaders("")
            return fetch(`https://scratch.mit.edu/site-api/comments/user/${context.username}/toggle-comments/`, {
                "credentials": "include",
                "headers": {...head},
                "method": "POST",
                "mode": "cors"
            })
        }

        sContext.myStuff = {
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

        sContext.getAccountNavJson = () => {
            return fetch("https://scratch.mit.edu/fragment/account-nav.json", {
                "credentials": "include",
                headers,
                "method": "GET",
                "mode": "cors"
            })
        }

        sContext.getSession = () => {
            return fetch("https://scratch.mit.edu/session/", {
                "credentials": "include",
                headers,
                "method": "GET",
                "mode": "cors",
            })
        }

        sContext.getMessages = (offset, limit) => {
            return fetch(`https://api.scratch.mit.edu/users/${context.username}/messages?limit=${limit}}&offset=${offset}`, {
                "credentials": "include",
                headers,
                "method": "GET",
                "mode": "cors",
            })
        }

        sContext.shareProject = projectId => {
            return fetch(`https://api.scratch.mit.edu/proxy/projects/${projectId}/share`, {
                "credentials": "include",
                headers,
                "method": "PUT",
                "mode": "cors",
            })
        }

        sContext.unshareProject = projectId => {
            return fetch(`https://api.scratch.mit.edu/proxy/projects/${projectId}/unshare`, {
                "credentials": "include",
                headers,
                "method": "PUT",
                "mode": "cors",
            })
        }
    }
}