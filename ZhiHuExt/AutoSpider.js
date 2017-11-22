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
const aloneRec = $("#aloneRec")[0], repeat = $("#repeat")[0], wtime = $("#waittime")[0], maxact = $("#maxact")[0];

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
    utimeOld.set(uid, lasttime);
    if (aloneRec.checked)
    {
        chkreports.add(rec);
        return false;
    }
    else
        return true;
}

function pmsbypasser()
{
    const pms = $.Deferred();
    /**@param {StandardDB} rec*/
    const bypasser2 = (rec, uid, lasttime) =>
    {
        utimeOld.set(uid, lasttime);
        pms.resolve();
        if (aloneRec.checked)
        {
            chkreports.add(rec);
            return false;
        }
        else
            return true;
    }
    return [pms, bypasser2];
}

async function fastChk(bypass, uid, begintime, limittime)
{
    const user = await ContentBase.checkUserState(uid, bypass, [maxact.value, limittime]);
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
            let limittime = 0, begintime = Math.floor(new Date().getTime() / 1000);
            const fixsleeper = _sleep(Number(wtime.value));
            let chkpms;
            if (!uids.has(uid))
            {
                if (maxact.value == 0)
                {
                    fastChk(bypasser, uid);
                }
                else
                {
                    const [pms, bypass2] = pmsbypasser();
                    fastChk(bypass2, uid);
                    await pms;
                    utimeNew.set(uid, begintime);
                }
            }
            else if(maxact.value > 0)
            {
                limittime = utimeNew.get(uid);
                utimeNew.set(uid, begintime);
                const actspms = ContentBase.fetchUserActs(uid, maxact.value, limittime, begintime);
                const user = uids.get(uid);
                const newdata = { usr: { id: user.id, name: user.name }, index: rowcount++ };
                Object.assign(newdata, user);
                thetable.row.add(newdata);
                thetable.draw(false);
                const acts = (await actspms).acts;
                if (aloneRec)
                    chkreports.add(acts);
                else
                    ContentBase._report("batch", acts);
            }
            await fixsleeper;
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
        ContentBase._report("batch", report);
    }
    reader.readAsText(files[0]);
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


