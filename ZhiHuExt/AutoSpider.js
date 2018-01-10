"use strict"

/**@type {Map<string, User>}}*/
const uids = new Map();
/**@type {Map<string, number>}}*/
const utimeOld = new Map(), utimeNew = new Map();
const u404s = new Set();
const chkreports = new StandardDB();
let isRunning = false;
let rowcount = 0;

/**@type {HTMLInputElement}}*/
const aloneRec = $("#aloneRec")[0], repeat = $("#repeat")[0], fromold = $("#fromold")[0], wtime = $("#waittime")[0], maxact = $("#maxact")[0], limitdate = $("#limitdate")[0];

const thetable = $("#maintable").DataTable(
    {
        paging: true,
        lengthMenu: [[10, 20, 50, -1], [10, 20, 50, "All"]],
        data: [],
        order: [[6, "desc"]],
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
            { data: "index" }
        ]
    });

/**
 * @param {StandardDB} rec
 */
const bypasser = (rec, uid, lasttime) =>
{
    if (!rec) return;
    utimeOld.set(uid, lasttime);
    if (aloneRec.checked)
    {
        chkreports.add(rec);
        return false;
    }
    else
        return true;
}

async function fastChk(uid, begintime, wailtAll)
{
    ContentBase.BASE_LIM_DATE = new Date(limitdate.value).toUTCSeconds();
    const user = await ContentBase.checkUserState(uid, bypasser, [maxact.value], wailtAll);
    if (!user)
    {
        u404s.add(uid);
        return;
    }
    uids.set(user.id, user);
    utimeNew.set(uid, begintime);
    const newdata = { usr: { id: user.id, name: user.name }, index: rowcount++ };
    Object.assign(newdata, user);
    thetable.row.add(newdata);
    thetable.draw(false);
}

async function monitorCycle(btn, objs)
{
    while (isRunning)
    {
        for (let i = 0; isRunning && i < objs.length; ++i)
        {
            const uid = objs[i];
            btn.textContent = uid;
            let begintime = new Date().toUTCSeconds();
            const sleeper = _sleep(Number(wtime.value));
            let chkpms;
            if (!uids.has(uid))
            {
                if (maxact.value == 0)
                    fastChk(uid, begintime, false);
                else
                    await fastChk(uid, begintime, true);
            }
            else if(maxact.value > 0)
            {
                const limittime = repeat.checked ? utimeNew.get(uid) : new Date(limitdate.value).toUTCSeconds();
                if (fromold.checked)
                    begintime = utimeOld.get(uid);
                else
                    utimeNew.set(uid, begintime);
                const actspms = ContentBase.fetchUserActs(uid, maxact.value, limittime, begintime);
                const user = uids.get(uid);
                const newdata = { usr: { id: user.id, name: user.name }, index: rowcount++ };
                Object.assign(newdata, user);
                thetable.row.add(newdata);
                thetable.draw(false);
                const acts = (await actspms).acts;
                if (aloneRec.checked)
                    chkreports.add(acts);
                else
                    ContentBase._report("batch", acts);
            }
            await sleeper;
        }
        if (!repeat.checked)
            return;
    }
}

$(document).on("click", "#show404", e =>
{
    $("#out404")[0].value = JSON.stringify(u404s.toArray());
});
$(document).on("click", "#del404", e =>
{
    u404s.clear();
});
$(document).on("click", "#refresh", e =>
{
    thetable.draw(false);
});
$(document).on("click", "#export", e =>
{
    const btn = e.target;
    btn.textContent = "合并";
    const res = chkreports.selfMerge();
    btn.textContent = "导出";
    const time = new Date().Format("yyyyMMdd-hhmm");
    DownloadMan.exportDownload(res, "json", `AutoSpider-${time}.json`);
});
$(document).on("click", "#import", e =>
{
    const btn = e.target;
    const files = $("#infile")[0].files;
    if (files.length <= 0)
        return;
    const reader = new FileReader();
    reader.onload = e =>
    {
        const content = e.target.result;
        const report = JSON.parse(content);
        console.log(report);
        const details = report.details;
        report.details = [];
        ContentBase._report("batch", report);
        for (let i = 0; i < details.length; i += 5000)
            ContentBase._report("details", details.slice(i, i + 5000));
    }
    reader.readAsText(files[0]);
});
$(document).on("click", "#chkban", async e =>
{
    const btn = e.target;
    repeat.checked = false;
    if (isRunning)
    {
        isRunning = false;
        btn.textContent = "复查封禁";
        return;
    }
    isRunning = true;
    let objs;
    if (e.ctrlKey)
    {
        const txt = $("#userinput")[0].value;
        objs = JSON.parse(txt);
        const banset = (await ContentBase.checkSpam("users", objs)).banned;
        objs = objs.filter(uid => !u404s.has(uid) && banset.has(uid));
        const usrs = await DBfunc("getAny", "users", "id", objs);
        usrs.forEach(usr => uids.set(usr.id, usr));
    }
    else
    {
        objs = Array.from(uids.values()).filter(u => u.status !== "").mapToProp("id");
    }
    console.log(`here [${objs.length}] obj users`);

    if (fromold.checked)
    {
        const info = await DBfunc("getAny", "rectime", "id", objs);
        info.forEach(i => utimeOld.set(i.id, i.old));
    }

    await monitorCycle(btn, objs);

    isRunning = false;
    btn.textContent = "完毕";
});

$(document).on("click", "#go", async e =>
{
    const btn = e.target;
    if (isRunning)
    {
        isRunning = false;
        btn.textContent = "开始";
        return;
    }
    isRunning = true;
    const isCtrl = e.ctrlKey;
    try
    {
        const txt = $("#userinput")[0].value;
        let objs = JSON.parse(txt);
        if (!repeat.checked)
            objs = objs.filter(uid => !uids.has(uid));
        const banset = isCtrl ? new Set() : (await ContentBase.checkSpam("users", objs)).banned;
        objs = objs.filter(uid => !u404s.has(uid) && !banset.has(uid));
        console.log(`here [${objs.length}] obj users`);

        if (fromold.checked)
        {
            const info = await DBfunc("getAny", "rectime", "id", objs);
            info.forEach(i => utimeOld.set(i.id, i.old));
        }

        await monitorCycle(btn, objs);

        isRunning = false;
        btn.textContent = "完毕";
    }
    catch (e)
    {
        console.warn(e);
        isRunning = false;
    }
});


!function ()
{
    ContentBase.checkUserState("zhihuadmin");

}()

