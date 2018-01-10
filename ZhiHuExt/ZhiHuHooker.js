"use strict"

!function ()
{
    if (!window.location.host.includes("zhihu.com"))
        return;
    function Hooker(extid)
    {
        "use strict"
        window.BLOCKING_VOTER = false;
        /**@description parse query string to key-value object
         * @param {string} qurl URL's query string
         * @returns {{[x:string]: string}} key-value object
         */
        function _getQueryString(qurl)
        {
            const querys = qurl.split("&");
            const ret = {};
            for (let i = 0; i < querys.length; ++i)
            {
                const p = querys[i].split('=');
                if (p.length != 2) continue;
                ret[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
            }
            return ret;
        };
        /**
         * @param {string} req
         * @param {string} api
         * @param {Promise<Response>} pms
         * @param {string} target
         * @param {{}} [extra]
         */
        async function sendData(req, pms, api, target, extra)
        {
            const resp = await pms;
            if (resp.ok)
            {
                try
                {
                    const cloned = resp.clone();
                    chrome.runtime.sendMessage(extid, { url: req, api: api, target: target, data: await cloned.text(), extra: extra });
                }
                catch (e)
                {
                    console.warn(e);
                }
            }
            return resp;
        }
        /**
         * @param {HTMLElement} blockdom
         * @param {string} api
         * @param {string} id
         * @returns {Promise<Response>}
         */
        function blockVoter(blockdom, api, id)
        {
            id = typeof (window.BLOCKING_VOTER) === "number" ? window.BLOCKING_VOTER : id;
            if (blockdom)
                document.body.removeChild(blockdom);
            return new Promise(resolve =>
            {
                chrome.runtime.sendMessage(extid, { api: api, target: "BLOCKING", id: Number(id), data: null }, ret =>
                {
                    const resp = new Response(new Blob([ret], { type: "application/json" }),
                        { status: 200, statusText: "OK", headers: new Headers({ "X-Backend-Server": "ZhiHuExt---localhost[127.0.0.1]" }) });
                    resolve(resp);
                });
            });
        }
        const oldfetch = fetch;
        if (window)
            window.oldfetch = fetch;
        /**
         * @param {string} req
         * @param {RequestInit} [init]
         * @returns {Promise<Response>}
         */
        async function newfetch(req, init)
        {
            if (!req.includes("www.zhihu.com/api/v"))
                return oldfetch(req, init);
            const apiparts = req.substring(req.indexOf("/api/v") + 8, req.indexOf("?")).split("/");
            let newreq = req;
            {
                newreq = newreq.replace("limit=10", "limit=20");//accelerate
                if (apiparts[0] === "articles")//simple fix for articles api(lacks voteup_count field)
                    newreq = newreq.replace("follower_count%2C", "answer_count%2Carticles_count%2Cfollower_count%2C");//detail
                else
                    newreq = newreq.replace("follower_count%2C", "voteup_count%2Canswer_count%2Carticles_count%2Cfollower_count%2C");//detail
                if (apiparts[0] === "members")//quick check for statis
                {
                    if (!apiparts[2])
                    {
                        if (newreq.includes("?include="))
                            newreq = newreq.replace("?include=", "?include=account_status,voteup_count,answer_count,articles_count,follower_count,");
                        else
                            newreq = newreq + "?include=account_status,voteup_count,answer_count,articles_count,follower_count"
                    }
                    else if (apiparts[2].startsWith("follow"))
                        newreq = newreq.replace("answer_count", "account_status,voteup_count,answer_count,articles_count,follower_count");
                }
            }
            const pms = oldfetch(newreq, init);
            const BLOCKING_FLAG = document.querySelector("#ZHE_BLOCKING_VOTER");
            const shouldBlock = window.BLOCKING_VOTER ? window.BLOCKING_VOTER : (BLOCKING_FLAG ? true : false);
            if (apiparts[0] === "members")//capture [members, {id}, ...]
            {
                if (!apiparts[2])//empty, dirty hook for locked user
                {
                    const resp = await pms;
                    if (resp.ok)
                    {
                        try
                        {
                            const rettxt = await resp.text();
                            chrome.runtime.sendMessage(extid, { url: req, api: "members", target: "empty", data: rettxt });
                            const ret = JSON.parse(rettxt);
                            if (ret.account_status instanceof Array)
                                ret.account_status.forEach(status =>
                                {
                                    if (status.name === "lock")
                                        status.name = "hang";
                                });
                            return new Promise(resolve =>
                            {
                                const newresp = new Response(new Blob([JSON.stringify(ret)], { type: "application/json" }),
                                    { status: 200, statusText: "OK", headers: resp.headers });
                                resolve(newresp);
                            });
                        }
                        catch (e)
                        {
                            console.warn(e);
                        }
                    }
                    return resp;
                }
                else
                    return sendData(req, pms, "members", apiparts[2], { uid: apiparts[1] });
            }
            else if (apiparts[0] === "answers" && apiparts[2] === "voters")
            {
                return shouldBlock ? blockVoter(BLOCKING_FLAG, "answer", apiparts[1]) : sendData(req, pms, "answers", "voters", { id: apiparts[1] });
            }
            else if (apiparts[0] === "articles" && apiparts[2] === "likers")
            {
                return shouldBlock ? blockVoter(BLOCKING_FLAG, "article", apiparts[1]) : sendData(req, pms, "articles", "voters", { id: apiparts[1] });
            }
            else if (apiparts[0] === "questions" && apiparts[2] === "answers")
            {
                return sendData(req, pms, "questions", "answers", { id: apiparts[1] });
            }
            else if (apiparts[0] === "explore" && apiparts[1] === "recommendations")
            {
                return sendData(req, pms, "explore", "recommendations");
            }
            else if (apiparts[0] === "search_v3")
            {
                const query = _getQueryString(req.substring(req.indexOf("?") + 1));
                return sendData(req, pms, "search", query.t);
            }
            else if (apiparts[0] === "feed" && apiparts[1] === "topstory")//apiv3
            {
                return sendData(req, pms, "feed", "topstory");
            }
            else
                return pms;
        }
        fetch = newfetch;
        console.log("[fetch] hooked");

        const mth = window.location.pathname.match(/\/people\/([^\/]+)/i);
        const oldJParse = JSON.parse;
        /**@param {string} txt*/
        function newParse(txt)
        {
            const obj = oldJParse(txt);
            if (obj.entities && obj.entities.users && obj.entities.users[mth[1]])
            {
                console.log("reach user!", obj);
                JSON.parse = oldJParse;
                console.log("[JSON.parse] unhooked");
                obj.entities.users[mth[1]].accountStatus.forEach(status =>
                {
                    if (status.name === "lock")
                        status.name = "hang";
                });
            }
            return obj;
        }
        if (mth)
        {
            JSON.parse = newParse;
            console.log("[JSON.parse] hooked");
        }
        
    }
    

    const inj = document.createElement("script");
    inj.innerHTML = `(${Hooker})("${chrome.runtime.id}");`;
    document.documentElement.appendChild(inj);
}()




