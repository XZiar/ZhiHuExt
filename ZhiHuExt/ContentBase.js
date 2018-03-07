"use strict"

let _CUR_USER;
let _CUR_ANSWER;
let _CUR_QUESTION;
/**@type {UserToken}*/
let _CUR_TOKEN;
let _Base_Lim_Date = new Date(2017, 1, 1).toUTCSeconds();
class ContentBase
{
    static get CUR_USER() { return _CUR_USER; }
    static set CUR_USER(user) { _CUR_USER = user; }
    static get CUR_ANSWER() { return _CUR_ANSWER; }
    static set CUR_ANSWER(ans) { _CUR_ANSWER = ans; }
    static get CUR_QUESTION() { return _CUR_QUESTION; }
    static set CUR_QUESTION(qst) { _CUR_QUESTION = qst; }
    static get CUR_TOKEN() { return _CUR_TOKEN; }
    static set CUR_TOKEN(token) { _CUR_TOKEN = token; }
    static get BASE_LIM_DATE() { return _Base_Lim_Date; }
    static set BASE_LIM_DATE(time) { time = _Base_Lim_Date; }

    static _defErrorHandler(name, pms)
    {
        return (data, status, xhr) =>
        {
            if (data.responseJSON)
                console.warn(name, "fail:", xhr.status, data.responseJSON.error.message);
            else
                console.warn(name, "fail:", xhr.status);
            pms.reject();
        };
    }

    /**
     * @param {"answer" | "article"} obj
     * @param {number | string} id
     * @param {number} offset
     * @returns {Promise<{users: User[], end: boolean, start: boolean, total: number}>}
     */
    static _fetchAnsVoters(obj, id, offset)
    {
        const part = (obj === "answer") ? "voters" : "likers";
        const zanquery = (obj === "answer") ? ",voteup_count" : "";
        const pms = $.Deferred();
        ContentBase._get(`https://www.zhihu.com/api/v4/${obj}s/${id}/${part}?include=data[*].answer_count,articles_count,follower_count${zanquery}&limit=20&offset=${offset}`)
            .done((data, status, xhr) =>
            {
                const users = data.data.map(User.fromRawJson);
                pms.resolve({ "users": users, "end": data.paging.is_end, "start": data.paging.is_start, "total": data.paging.totals });
            })
            .fail(ContentBase._defErrorHandler("fetchVoter", pms));
        return pms;
    }
    /**
     * @param {object} header
     * @param {string} uid
     * @param {number} [time]
     */
    static _fetchUserActs(header, uid, time)
    {
        const pms = $.Deferred();
        ContentBase._get(`https://www.zhihu.com/api/v4/members/${uid}/activities?limit=20&after_id=${time}&desktop=True`, undefined, header)
            .done((data, status, xhr) =>
            {
                const acts = APIParser.parsePureActivities(data.data);
                const lastitem = data.data.last();
                pms.resolve({ acts: acts, end: data.paging.is_end, lasttime: lastitem ? lastitem.created_time : undefined });
            })
            .fail(ContentBase._defErrorHandler("fetchActs", pms));
        return pms;
    }
    /**
     * @param {string | number} qid
     * @param {number} offset
     */
    static _fetchAnswers(qid, offset)
    {
        const pms = $.Deferred();
        ContentBase._get(`https://www.zhihu.com/api/v4/questions/${qid}/answers?include=data[*].is_normal,admin_closed_comment,reward_info,is_collapsed,annotation_action,annotation_detail,collapse_reason,is_sticky,collapsed_by,suggest_edit,comment_count,can_comment,content,editable_content,voteup_count,reshipment_settings,comment_permission,created_time,updated_time,review_info,question,excerpt,relationship.is_authorized,is_author,voting,is_thanked,is_nothelp,upvoted_followees;data[*].mark_infos[*].url;data[*].author.voteup_count,answer_count,articles_count,follower_count,badge[?(type=best_answerer)].topics&offset=${offset}&limit=30&sort_by=default`)
            .done((data, status, xhr) =>
            {
                pms.resolve({ data: data.data, end: data.paging.is_end });
            })
            .fail(ContentBase._defErrorHandler("fetchAnss", pms));
        return pms;
    }
    /**
     * @param {string | number} aid
     * @param {number} offset
     */
    static _fetchComments(aid, offset)
    {
        const pms = $.Deferred();
        ContentBase._get(`https://www.zhihu.com/api/v4/answers/${aid}/comments?include=data[*].author,collapsed,reply_to_author,disliked,content,voting,vote_count,is_parent_author,is_author&order=normal&limit=20&offset=${offset}&status=open`)
            .done((data, status, xhr) =>
            {
                pms.resolve({ data: data.data, end: data.paging.is_end, total: data.paging.totals });
            })
            .fail(ContentBase._defErrorHandler("fetchComment", pms));
        return pms;
    }
    /**
     * @param {string} uid
     * @param {"followees" | "followers"} obj
     * @param {number} offset
     * @returns {{data: User[], end: boolean, total: number}}
     */
    static _fetchFollows(uid, obj, offset)
    {
        const pms = $.Deferred();
        ContentBase._get(`https://www.zhihu.com/api/v4/members/${uid}/${obj}?include=data[*].account_status,gender,voteup_count,answer_count,follower_count,is_followed,is_following,badge[?(type=best_answerer)].topics&limit=20&offset=${offset}`)
            .done((data, status, xhr) =>
            {
                pms.resolve({ data: data.data.map(User.fromRawJson), end: data.paging.is_end, total: data.paging.totals });
            })
            .fail(ContentBase._defErrorHandler("fetchFollow", pms));
        return pms;
    }

    static _get(url, data, headers)
    {
        return $.ajax(url,
            {
                type: "GET",
                data: data,
                headers: headers,
                statusCode:
                {
                    429: xhr => xhr.fail()
                }
            });
    }
    static _post(url, data, headers)
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
                headers: headers,
                data: data
            });
    }
    /**
     * @param {"batch" | string} target
     * @param {object[] | object | StandardDB} data
     */
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
     * fetch answer/article 's voter
     * @param {"answer" | "article"} obj
     * @param {string | number} id
     * @param {number} limit
     * @param {"old" | "new" | "old+"} config
     * @param {function(number, number):void} onProgress
     */
    static async fetchTheVoters(obj, id, limit, config, onProgress)
    {
        let errcnt = 0;
        const first = await ContentBase._fetchAnsVoters(obj, id, 0);
        /**@type {User[]}*/
        let ret = config === "old+" ? [] : first.users;
        let oldtotal = first.total, demand = Math.min(oldtotal, limit)
        let left = demand - first.users.length;
        if (left <= 0)
            return ret;
        let offset = 20;
        if (config === "old" || config === "old+")
            offset = oldtotal - left;
        let isEnd = false;
        const usrset = new Set(ret.mapToProp("id"))
        while (left > 0 && !isEnd)
        {
            try
            {
                const part = await ContentBase._fetchAnsVoters(obj, id, offset);
                const newtotal = part.total;
                const newusrs = part.users.filter(u => !usrset.has(u.id));
                newusrs.forEach(u => usrset.add(u.id));
                ret = ret.concat(newusrs);
                const len = 20;
                demand += newtotal - oldtotal;
                offset += len, left -= len - (newtotal - oldtotal);
                oldtotal = newtotal;
                if (onProgress)
                    onProgress(ret.length, demand);
                isEnd = part.end;
            }
            catch (e)
            {
                if (++errcnt > 5)
                    break;
                else
                    continue;
            }
        }
        return ret;
    }

    /**
     * @param {string} uid
     * @param {number} maxloop
     * @param {number} [limittime]
     * @param {number} [begintime]
     * @param {function(number, number):void} onProgress
     */
    static async fetchUserActs(uid, maxloop, limittime, begintime, onProgress)
    {
        let errcnt = 0;
        let time = begintime || new Date().toUTCSeconds(); 
        limittime = limittime || ContentBase.BASE_LIM_DATE;
        const tokenhead = ContentBase.CUR_TOKEN.toHeader();
        const ret = new StandardDB();
        let isEnd = false;
        for (let i = 0; i < maxloop && time > limittime && !isEnd; ++i)
        {
            try
            {
                //add sleep to avoid query too frequent(when the network id too good for it)
                const [part, dummy] = await Promise.all([ContentBase._fetchUserActs(tokenhead, uid, time), _sleep(350)]);
                if (!part.lasttime)
                    break;
                ret.add(part.acts);
                time = part.lasttime;
                if (onProgress)
                    onProgress(i, time);
                isEnd = part.end;
            }
            catch (e)
            {
                if (++errcnt > 5)
                    break;
                else
                    continue;
            }
        }
        console.log("fetchUserActs finished, lasttime:", time);
        return { acts: ret, lasttime: time };
    }

    static async fetchAnswers(qid, limit)
    {
        let errcnt = 0;
        const whole = [];
        let isEnd = false;
        for (let offset = 0; offset < limit && !isEnd;)
        {
            try
            {
                const part = await ContentBase._fetchAnswers(qid, offset);
                whole.push(...part.data);
                isEnd = part.end;
                offset += part.data.length;
            }
            catch (e)
            {
                if (++errcnt > 5)
                    break;
                else
                    continue;
            }
        }
        return whole;
    }

    static async fetchComments(aid, limit)
    {
        const whole = [];
        let isEnd = false;
        for (let offset = 0; offset < limit && !isEnd;)
        {
            try
            {
                const part = await ContentBase._fetchComments(aid, offset);
                whole.push(...part.data);
                isEnd = part.end;
                offset += part.data.length;
            }
            catch (e)
            {
                if (++errcnt > 5)
                    break;
                else
                    continue;
            }
        }
        return whole;
    }

    /**
     * @param {string} uid
     * @param {"followees" | "followers"} obj
     * @param {number} limit
     */
    static async fetchFollows(uid, obj, limit)
    {
        /**@type {User[]}*/
        const whole = [];
        let isEnd = false;
        for (let offset = 0; offset < limit && !isEnd;)
        {
            try
            {
                const part = await ContentBase._fetchFollows(uid, obj, offset);
                whole.push(...part.data);
                isEnd = part.end;
                offset += part.data.length;
            }
            catch (e)
            {
                if (++errcnt > 5)
                    break;
                else
                    continue;
            }
        }
        /**@type {{users:User[],follows:Follow[]}}*/
        const res = { users: whole, follows: [] };
        if (obj === "followers")
            res.follows = whole.map(ufrom => new Follow(ufrom, uid));
        else
            res.follows = whole.map(uto => new Follow(uid, uto));
        return res;
    }

    /**
     * @param {string} uid
     * @param {function(StandardDB, string, number):boolean} [bypass]
     * @param {[number, number=, function=]} [chkacts]
     * @param {boolean} [waitAll]
     * @returns {Promise<User>}
     */
    static checkUserState(uid, bypass, chkacts, waitAll)
    {
        waitAll = waitAll || false; 
        const pms = $.Deferred();
        const curtime = new Date().toUTCSeconds();
        const tail = async function (state, user)
        {
            const entities = APIParser.parseEntities(state.entities);
            let reportdata;
            let lasttime = Math.min(curtime, ...Object.keys(state.entities.activities).map(Number));
            //skip fetchActs cause it should be hadle outside with more iteration
            //but if waitAll is defined, it means the demand for extra activities are clear
            const limit = (!waitAll && (user.status === "ban" || user.status === "sban")) ? 0 : (chkacts ? chkacts[0] : 0);
            if (chkacts && lasttime != curtime)
            {
                const actsret = await ContentBase.fetchUserActs(uid, limit, chkacts[1], lasttime, chkacts[2]);
                lasttime = actsret.lasttime;
                reportdata = entities.add(actsret.acts);
            }
            else
                reportdata = entities;
            if (waitAll)
                pms.resolve(user);
            const shouldReport = bypass ? bypass(entities, uid, lasttime) : true;
            if (shouldReport)
                ContentBase._report("batch", entities);
            console.log(entities);
        };
        ContentBase._get("https://www.zhihu.com/people/" + uid + "/activities")
            .then(data =>
            {
                const newData = ContentBase.keepOnlyDataDiv(data);
                const div = document.createElement("div");
                div.innerHTML = newData;
                const dataElement = div.querySelector("#data");
                if (!dataElement)
                {
                    pms.resolve(null);
                    if (bypass) bypass();
                    return;
                }
                const state = JSON.parse(dataElement.dataset.state);
                ContentBase.CUR_TOKEN = new UserToken(state.token);
                const theuser = state.entities.users[uid];
                if (!theuser)
                {
                    pms.resolve(null);
                    if (bypass) bypass();
                    return;
                }
                const user = User.fromRawJson(theuser);
                if (!waitAll)
                    pms.resolve(user);
                tail(state, user);
            }, (e) => { console.warn(e); pms.resolve(null); if (bypass) bypass(); });
        return pms;
    }

    /**
     * @param {"users" | "answer" | "article"} target
     * @param {string | string[]} data
     * @returns {{banned: Set<string>, spamed: Set<string>, total: number, normal: string[]}}
     */
    static checkSpam(target, data)
    {
        const pms = $.Deferred();
        if (!data || (data instanceof Array && data.length === 0))
            pms.resolve({ banned: new Set(), spamed: new Set(), total: 0 });
        else
        {
            const users = (data instanceof Array ? data : [data]);
            chrome.runtime.sendMessage({ action: "chkspam", target: target, data: users },
                ret => pms.resolve({ banned: new Set(ret.banned), spamed: new Set(ret.spamed), total: ret.total, normal: ret.normal }));
        }
        return pms;
    }
}


