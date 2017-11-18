"use strict"

/**@type {{[x:string]: User}}*/
let finalUserMap;
/**@type {SimpleBag}*/
let finalBag;

/**
 * @param {...BagArray} voters
 */
async function StatVoters(...voters)
{
    console.log("arrive voters", voters);
    const bag = voters.filter(v => v != null).reduce((prev, cur) => prev.union(cur), new SimpleBag());
    const uids = bag.elements();

    /**@type {{[x:string]: User}}*/
    const usrMap = await DBfunc("getDetailMapOfIds", "users", uids, "id");

    let bansum = 0, sum = 0;

    const data = bag.map((uid, count) =>
    {
        const user = usrMap[uid];
        sum += count;
        if (user.status === "ban" || user.status === "sban")
            bansum += count;
        return { usr: { name: user.name, id: user.id }, status: user.status, artcnt: user.artcnt, anscnt: user.anscnt, follower: user.follower, zancnt: user.zancnt, count: count };
    });
    $("#zansum").text(sum);
    $("#banzansum").text(bansum);
    $("#maintable").DataTable(
        {
            paging: true,
            lengthMenu: [[20, 50, 100, -1], [20, 50, 100, "All"]],
            data: data,
            order: [[6, "desc"], [5, "desc"], [1, "asc"]],
            columns:
            [
                {
                    data: "usr",
                    render: displayRender(dat => `<a class="bgopen usr" data-id="${dat.id}" href="https://www.zhihu.com/people/${dat.id}">${dat.name}</a>`)
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
 */
async function chkUser(objuser, anchor)
{
    const user = await ContentBase.checkUserState(objuser.id);
    if (!user)
        return;
    finalUserMap[user.id] = user;
    if (user.status === "ban" || user.status === "sban")
        anchor.style.background = "red";
}

$(document).on("click", "#chkAllStatus", async e =>
{
    const btn = e.target;
    /**@type {HTMLAnchorElement[]}*/
    const anchors = $("#maintable").find(".usr").toArray();
    const objs = anchors.map(a => [a, finalUserMap[a.dataset.id]]).filter(([a, u]) => u.status === "" && u.id !== "");
    console.log(`here [${objs.length}] obj users`);
    for (let i = 0; i < objs.length; ++i)
    {
        const [anchor, objuser] = objs[i];
        chkUser(objuser, anchor);
        btn.textContent = objuser.id;
        await _sleep(1000);
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

!async function()
{
    /**@type {{[x: string]: string}}*/
    const qs = _getQueryString();

    /**@type {BagArray[]}*/
    let voters;

    if (qs.uid != null)
    {
        const uids = qs.uid.split("*");
        /**@type {[number[], number[]]}*/
        const [artids, ansids] = await Promise.all([DBfunc("getIdByAuthor", uids, "article"), DBfunc("getIdByAuthor", uids, "answer")]);
        voters = await Promise.all([DBfunc("getVoters", artids, "article"), DBfunc("getVoters", ansids, "answer")]);
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
    else if (qs.vblob != null)
    {
        voters = [await fetch(qs.vblob)];
    }
    if (voters != null)
        StatVoters(...voters);
}()

