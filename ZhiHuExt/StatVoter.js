"use strict"

/**@type {{[x:string]: User}}*/
let finalUserMap;
/**@type {SimpleBag}*/
let finalBag;
let CUR_ANSWER, CUR_

function reportSpam(id, type)
{
    const payload = { "resource_id": id, "type": type, "reason_type": "spam", "source": "web" };
    //req.setRequestHeader("Referer", "https://www.zhihu.com/people/" + id + "/activities");
    const pms = $.Deferred();
    ContentBase._post("https://www.zhihu.com/api/v4/reports", payload)
        .done((data, status, xhr) =>
        {
            if (xhr.status === 204 || xhr.status === 200)
            {
                pms.resolve();
                ContentBase._report("spams", { id: id, type: type });
            }
        })
        .fail((data, status, xhr) =>
        {
            if (data.responseJSON)
                pms.reject({ code: data.responseJSON.error.code, error: data.responseJSON.error.message });
            else
                pms.reject({ code: xhr.status, error: "unknown error" });
        })
    return pms;
}

/**
 * @param {...BagArray} voters
 */
async function StatVoters(...voters)
{
    console.log("arrive voters", voters);
    let bag = voters.filter(v => v != null).reduce((prev, cur) => prev.union(cur), new SimpleBag());
    if (bag.size > 30000)
        bag = bag.above(1);
    const uids = bag.elements();

    /**@type {{[x:string]: User}}*/
    const usrMap = await DBfunc("getDetailMapOfIds", "users", uids, "id", "head");

    let bansum = 0, sum = 0;

    const data = bag.map((uid, count) =>
    {
        const user = usrMap[uid];
        sum += count;
        if (!user)
            return { usr: { name: uid, id: uid }, status: "", artcnt: -1, anscnt: -1, follower: -1, zancnt: -1, count: count };
        if (user.status === "ban" || user.status === "sban")
            bansum += count;
        return { usr: { name: user.name, id: user.id }, status: user.status, artcnt: user.artcnt, anscnt: user.anscnt, follower: user.follower, zancnt: user.zancnt, count: count };
    });
    $("#zansum").text(sum);
    $("#banzansum").text(bansum);
    $("#maintable").DataTable(
        {
            paging: true,
            deferRender: true,
            lengthMenu: [[20, 100, 200, -1], [20, 100, 200, "All"]],
            data: data,
            order: [[6, "desc"], [5, "desc"], [1, "asc"]],
            columns:
            [
                {
                    data: "usr",
                    render: displayRender(dat => `<a class="bgopen usr" data-id="${dat.id}" href="https://www.zhihu.com/people/${dat.id}">${dat.name}</a>
                    <button class="Btn-ReportSpam" data-id="${dat.id}" data-type="member">广告</button>`)
                },
                {
                    data: "status",
                    render: displayRender(dat => dat === "ban" ? "停用" : (dat === "sban" ? "永禁言" : "正常？")),
                },
                { data: "artcnt" },
                { data: "anscnt" },
                { data: "follower" },
                { data: "zancnt" },
                { data: "count" }
            ]
        });
    finalUserMap = usrMap;
    finalBag = bag;
}



/**
 * @param {User} objuser
 * @param {HTMLAnchorElement} anchor
 * @param {boolean} deep
 */
async function chkUser(objuser, anchor, deep)
{
    const user = await ContentBase.checkUserState(objuser.id, undefined, [deep ? 20 : 4], deep);
    if (!user)
        return;
    finalUserMap[user.id] = user;
    if (user.status === "ban" || user.status === "sban")
    {
        anchor.style.background = "red";
        await ContentBase.checkUserState(objuser.id, undefined, [250], true);//extra check
    }
}

$(document).on("click", "#chkAllStatus", async e =>
{
    const btn = e.target;
    /**@type {HTMLAnchorElement[]}*/
    const anchors = $("#maintable").find(".usr").toArray();
    const objs = anchors.map(a => [a, finalUserMap[a.dataset.id]]).filter(([a, u]) => u && u.id !== "")
        .filter(e.ctrlKey ? ([a, u]) => a.style.background == "red" : ([a, u]) => u.status === "");
    console.log(`here [${objs.length}] obj users`);
    for (let i = 0; i < objs.length; ++i)
    {
        const [anchor, objuser] = objs[i];
        btn.textContent = objuser.id;
        await Promise.all([chkUser(objuser, anchor, e.ctrlKey), _sleep(800 + 40 * i)]);
    }
    btn.textContent = "检测全部";
});
$(document).on("click", "#assoc", e =>
{
    chrome.runtime.sendMessage({ action: "openpage", target: window.location.href.replace("StatVoter", "AssocAns"), isBackground: true });
});
$(document).on("click", "#export", e =>
{
    const head = "\uFEFF" + "名字,id,状态,文章数,回答数,关注者,赞数,点赞计数\n";
    let txt = head;
    finalBag.forEach((id, count) =>
    {
        const user = finalUserMap[id];
        txt += `${user.name},${id},${user.status},${user.artcnt},${user.anscnt},${user.follower},${user.zancnt},${count}\n`;
    });
    const time = new Date().Format("yyyyMMdd-hhmm");
    DownloadMan.exportDownload(txt, "txt", `StatVoter-${time}.csv`);
});
$(document).on("click", "#copyusr", e =>
{
    const request = { action: "copy", data: JSON.stringify(finalBag.elements()) };
    SendMsgAsync(request);
});
$("body").on("click", "button.Btn-ReportSpam", e =>
{
    const btn = e.target;
    reportSpam(btn.dataset.id, btn.dataset.type)
        .done(() => btn.style.backgroundColor = "rgb(0,224,32)")
        .fail((e) =>
        {
            console.warn("report fail:" + e.code, e.error);
            if (e.code === 103001)//repeat
                btn.style.backgroundColor = "rgb(224,224,32)";
            else if (e.code === 4039)//need verify
                btn.style.backgroundColor = "rgb(32,64,192)";
            else
                btn.style.backgroundColor = "rgb(224,0,32)";
        });
});
$("body").on("click", "button.Btn-Similarity", e =>
{
    const thisbtn = e.target;
    const msg = { action: "chksim", target: "user", data: null };
    /**@type {HTMLButtonElement[]}*/
    const btns = $("#maintable").find("button.Btn-ReportSpam").toArray();
    console.log("detect " + btns.length + " user");
    chrome.runtime.sendMessage(msg, /**@param {[string, [number, number, number]][]} result*/(result) =>
    {
        console.log(result);
        const simmap = new Map(result.data);
        let maxcnt = 0;
        btns.forEach(btn =>
        {
            const counts = simmap.get(btn.dataset.id);
            btn.textContent = `${counts[0]}(${counts[1]})/${counts[2]}`;
            btn.style.fontSize = "smaller";
            btn.style.fontWeight = "bold";
            maxcnt = Math.max(maxcnt, counts[0]);
        });
        thisbtn.textContent = `${maxcnt}(${result.limit})`;
        thisbtn.style.fontSize = "smaller";
        thisbtn.style.fontWeight = "bold";
    });
});

!async function()
{
    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();

    /**@type {BagArray[]}*/
    let voters;

    if (qs.athid != null)
    {
        const athid = qs.athid.split("*");
        voters = [await DBfunc("getVotersByAuthor", athid)];
    }
    else if (qs.qid != null)
    {
        const qids = qs.qid.split("*").map(Number);
        const anss = await DBfunc("getAnswerByQuestion", qids);
        voters = [await DBfunc("getVoters", anss.mapToProp("id"), "answer")];
    }
    else if (qs.ansid != null)
    {
        const aids = qs.ansid.split("*").map(Number);
        voters = [await DBfunc("getVoters", aids, "answer")];
    }
    else if (qs.artid != null)
    {
        const aids = qs.artid.split("*").map(Number);
        voters = [await DBfunc("getVoters", aids, "article")];
    }
    else if (qs.vid != null)
    {
        const vid = qs.vid.split("*");
        voters = [await DBfunc("getVotersByVoter", vid)];
    }
    else if (qs.votblob != null)
    {
        voters = [await (await fetch(qs.votblob)).json()];
    }
    else if (qs.uid != null)
    {
        voters = [qs.uid.split("*").map(uid => ({ key: uid, count: 1 }))];
    }
    if (voters != null)
        StatVoters(...voters);
}()

