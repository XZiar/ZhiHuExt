"use strict"

/**@type {Map<string, User>}}*/
let uids = new Map();
/**@type {Map<string, number>}}*/
let utimeOld = new Map();
/**@type {Map<string, number>}}*/
let utimeNew = new Map();
let u404s = new Set();
let chkreports = new StandardDB();
let isRunning = false;
let rowcount = 0;
let curBtn = null;

/**@type {HTMLInputElement}}*/
const aloneRec = $("#aloneRec")[0], autoLoop = $("#autoLoop")[0], wtime = $("#waittime")[0], maxact = $("#maxact")[0], limitdate = $("#limitdate")[0];
let repeatMode = "no";

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
    if(curBtn)
    {
        curBtn.style.background = user ? "green" : "red";
    }    
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
            else if (maxact.value > 0 || autoLoop.checked)
            {
                const limittime = repeatMode == "new" ? utimeNew.get(uid) : new Date(limitdate.value).toUTCSeconds();
                if (repeatMode == "old")
                    begintime = utimeOld.get(uid);
                else
                    utimeNew.set(uid, begintime);
                const actspms = ContentBase.fetchUserActs(uid, maxact.value, limittime, begintime);
                const user = uids.get(uid);
                const newdata = { usr: { id: user.id, name: user.name }, index: rowcount++ };
                Object.assign(newdata, user);
                thetable.row.add(newdata);
                thetable.draw(false);
                const acts = await actspms;
                utimeOld.set(uid, acts.lasttime);
                if (aloneRec.checked)
                    chkreports.add(acts.acts);
                else
                    ContentBase._report("batch", acts.acts);
            }
            await sleeper;
        }
        if (!autoLoop.checked)
            return;
    }
}


$(document).on("click", "input[name=repeat]:radio", e =>
{
    repeatMode = e.target.value;
});
$(document).on("click", "#show404", e =>
{
    $("#outbox")[0].value = JSON.stringify(u404s.toArray());
});
$(document).on("click", "#showban", e =>
{
    const bans = Array.from(uids.values()).filter(u=>u.status!="").mapToProp("id");
    $("#outbox")[0].value = JSON.stringify(bans);
});
$(document).on("click", "#del404", e =>
{
    u404s.clear();
});
$(document).on("click", "#refresh", e =>
{
    thetable.draw(false);
});
$(document).on("click", "#clean", e =>
{
    chkreports = new StandardDB();
});
$(document).on("click", "#bakstate", e=>
{
    const state = 
    { 
        users: Array.from(Array.from(uids.values())),
        utimeOld: Array.from(utimeOld.entries()),
        utimeNew: Array.from(utimeNew.entries()),
        u404s: u404s.toArray(),
        chkreports: chkreports,
        input: $("#userinput")[0].value
    };
    const time = new Date().Format("yyyyMMdd-hhmm");
    DownloadMan.exportDownload(state, "json", `AutoSpider-state-${time}.json`);
});
$("body").on("dragover", "#bakstate", ev => ev.preventDefault());
$("body").on("drop", "#bakstate", ev =>
{
    ev.preventDefault();
    const files = ev.originalEvent.dataTransfer.files;
    if (files.length <= 0)
        return;
    const reader = new FileReader();
    reader.onload = e => 
    {
        const content = e.target.result;
        const state = JSON.parse(content);
        console.log(state);
        uids.clear();
        rowcount = 0;
        thetable.clear();
        state.users.forEach(usr => 
        {
           let user = new User();
           Object.assign(user, usr);
           uids.set(user.id, user);
           const newdata = { usr: { id: user.id, name: user.name }, index: rowcount++ };
           Object.assign(newdata, user);
           thetable.row.add(newdata);
        });
        utimeOld = new Map(state.utimeOld);
        utimeNew = new Map(state.utimeNew);
        u404s = new Set(state.u404s);
        Object.assign(chkreports, state.chkreports);
        $("#userinput")[0].value = state.input;
        thetable.draw(false);
    }
    reader.readAsText(files[0]);
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
$(document).on("click", "#import", ev =>
{
    const btn = ev.target;
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
$(document).on("click", "#rfsold,#rfsnew", async e =>
{
    const btn = e.target;
    btn.textContent = "获取中";
    let objs;
    if (e.ctrlKey)
    {
        const txt = $("#userinput")[0].value;
        objs = JSON.parse(txt);
        const banset = (await ContentBase.checkSpam("users", objs)).banned;
        objs = objs.filter(uid => !u404s.has(uid) && banset.has(uid));
    }
    else
    {
        objs = Array.from(uids.values()).filter(u => u.status !== "").mapToProp("id");
    }
    const info = await DBfunc("getAny", "rectime", "id", objs);
    if (btn.id == "rfsold")
    {
        info.forEach(i => utimeOld.set(i.id, i.old));
        btn.textContent = "刷新最旧点";
    }
    else
    {
        info.forEach(i => utimeNew.set(i.id, i.new));
        btn.textContent = "刷新最新点";
    }
});
$(document).on("click", "#chkban", async e =>
{
    const btn = e.target;
    autoLoop.checked = false;
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
    curBtn = btn;
    const isCtrl = e.ctrlKey;
    try
    {
        const txt = $("#userinput")[0].value;
        let objs = JSON.parse(txt);
        if (repeatMode == "no")
            objs = objs.filter(uid => !uids.has(uid));
        const banset = isCtrl ? new Set() : (await ContentBase.checkSpam("users", objs)).banned;
        objs = objs.filter(uid => !u404s.has(uid) && !banset.has(uid));
        console.log(`here [${objs.length}] obj users`);

        await monitorCycle(btn, objs);

        isRunning = false;
        btn.textContent = "完毕";
    }
    catch (e)
    {
        console.warn(e);
        isRunning = false;
        curBtn.style.background = "";
        curBtn = null;
    }
});

