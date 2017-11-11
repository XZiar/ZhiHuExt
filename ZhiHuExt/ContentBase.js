"use strict"

const fetchVoters = Symbol("_fetchAnsVoters");
let _CUR_USER;
let _CUR_ANSWER;
class ContentBase
{
    static get CUR_USER() { return _CUR_USER; }
    static set CUR_USER(user) { _CUR_USER = user; }
    static get CUR_ANSWER() { return _CUR_ANSWER; }
    static set CUR_ANSWER(ans) { _CUR_ANSWER = ans; }

    /**
     * @param {number | string} ansId
     * @param {number} offset
     * @returns {Promise<{users: User[], end:boolean, start: boolean, total: number}>}
     */
    static [fetchVoters](ansId, offset)
    {
        const pms = $.Deferred();
        ContentBase._get(`https://www.zhihu.com/api/v4/answers/${ansId}/voters?include=data[*].answer_count,articles_count,follower_count&limit=20&offset=${offset}`)
            .done((data, status, xhr) =>
            {
                const users = data.data.map(User.fromRawJson);
                pms.resolve({ "users": users, "end": data.paging.is_end, "start": data.paging.is_start, "total": data.paging.totals });
            })
            .fail((data, status, xhr) =>
            {
                if (data.responseJSON)
                    console.warn("getAnsVoter fail:" + xhr.status, data.responseJSON.error.message);
                else
                    console.warn("getAnsVoter fail:" + xhr.status);
                pms.reject();
            })
        return pms;
    }

    static _get(url, data, type)
    {
        return $.ajax(url,
            {
                type: "GET",
                data: data,
                statusCode:
                {
                    429: xhr => xhr.fail()
                }
            });
    }
    static _post(url, data)
    {
        let cType;
        if (typeof data == "string")
            cType = "application/x-www-form-urlencoded";
        else
        {
            cType = "application/json";
            data = JSON.stringify(data);
        }
        return $.ajax(url,
            {
                type: "POST",
                contentType: cType,
                //dataType: "json",
                data: data
            });
    }
    static _report(target, data)
    {
        if (!data || (data instanceof Array && data.length === 0))
            return;
        chrome.runtime.sendMessage({ action: "insert", target: target, data: data });
    }
    static _update(target, key, objs, updator)
    {
        if (!objs || (objs instanceof Array && objs.length === 0))
            return;
        chrome.runtime.sendMessage({ action: "update", target: target, data: { key: key, obj: objs, updator: updator } });
    }
    /**@param {string} rawhtml*/
    static keepOnlyDataDiv(rawhtml)
    {
        return rawhtml.substring(rawhtml.indexOf('<div id="data"'), rawhtml.lastIndexOf('</div><script'));
    }

    /**
     * fetch answer's voter
     * @param {string | number} ansId
     * @param {number} limit
     * @param {"old" | "new"} config
     * @param {function(number, number):void} onProgress
     */
    static async fetchAnsVoters(ansId, limit, config, onProgress)
    {
        const first = await ContentBase[fetchVoters](ansId, 0);
        /**@type {User[]}*/
        let ret = first.users;
        const total = Math.min(first.total, limit);
        let left = total - first.users.length;
        if (left <= 0)
            return ret;
        let offset = 20;
        if (config === "old")
            offset = first.total - left;
        while (left > 0)
        {
            const part = await ContentBase[fetchVoters](ansId, offset);
            ret = ret.concat(part.users);
            const len = part.users.length;
            offset += len, left -= len;
            if (onProgress)
                onProgress(ret.length, total);
        }
        return ret;
    }
    /**
     * @param {number | string} uid
     * @returns {Promise<User>}
     */
    static checkUserState(uid)
    {
        const pms = $.Deferred();
        ContentBase._get("https://www.zhihu.com/people/" + uid + "/activities")
            .done((data) =>
            {
                const newData = ContentBase.keepOnlyDataDiv(data);
                const div = document.createElement("div");
                div.innerHTML = newData;
                const dataElement = div.querySelector("#data");
                if (!dataElement)
                {
                    pms.resolve(null);
                    return;
                }
                const state = JSON.parse(dataElement.dataset.state);
                const theuser = state.entities.users[uid];
                if (!theuser)
                {
                    pms.resolve(null);
                    return;
                }
                const user = User.fromRawJson(theuser);
                pms.resolve(user);
                //console.log(theuser);
                {
                    const entities = APIParser.parseEntities(state.entities);
                    ContentBase._report("batch", entities);
                    console.log(entities);
                }
            })
            .fail((e) => { console.warn(e); pms.resolve(null); });
        return pms;
    }

    /**
     * @param {"users"} target
     * @param {string | string[]} data
     * @returns {{banned: Set<string>, spamed: Set<string>}}
     */
    static checkSpam(target, data)
    {
        const pms = $.Deferred();
        if (!data || (data instanceof Array && data.length === 0))
            pms.resolve({ banned: new Set(), spamed: new Set() });
        else
        {
            const users = (data instanceof Array ? data : [data]);
            chrome.runtime.sendMessage({ action: "chkspam", target: target, data: users },
                ret => pms.resolve({ banned: new Set(ret.banned), spamed: new Set(ret.spamed) }));
        }
        return pms;
    }
}

!function ()
{
    function FetchHook()
    {
        /**
         * @param {string} req
         * @param {string} api
         * @param {Promise<Response>} pms
         * @param {string} target
         * @param {{}} extra
         */
        async function sendData(req, pms, api, target, extra)
        {
            const resp = await pms;
            if (resp.ok)
            {
                try
                {
                    const cloned = resp.clone();
                    chrome.runtime.sendMessage("jideeibijhnbkncjmdhhceajjjkfabje",
                        { url: req, api: api, target: target, data: await cloned.text(), extra: extra });
                }
                catch (e)
                {
                    console.warn(e);
                }
            }
            return resp;
        }
        const oldfetch = fetch;
        /**
         * @param {string} req
         * @param {RequestInit} [init]
         * @returns {Promise<Response>}
         */
        async function newfetch(req, init)
        {
            if (!req.includes("www.zhihu.com/api/v4/"))
                return oldfetch(req, init);
            const pms = oldfetch(req.replace("limit=10", "limit=20"), init);//accelerate
            const apiparts = req.substring(req.indexOf("/api/v4/") + 8, req.indexOf("?")).split("/");
            if (apiparts[0] === "members")//capture [members, {id}, ...]
            {
                return sendData(req, pms, "members", apiparts[2] || "empty");
            }
            else if (apiparts[0] === "answers" && apiparts[2] === "voters")
            {
                return sendData(req, pms, "answers", "voters", { id: apiparts[1] });
            }
            else if (apiparts[0] === "articles" && apiparts[2] === "likers")
            {
                return sendData(req, pms, "articles", "voters", { id: apiparts[1] });
            }
            else
                return pms;
        }
        fetch = newfetch;
        console.log("hooked");
    }
    

    const inj = document.createElement("script");
    inj.innerHTML = `(${FetchHook})();`;
    document.documentElement.appendChild(inj);
}()







