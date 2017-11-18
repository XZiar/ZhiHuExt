"use strict"

/**@type {User[]}}*/
const users = [];
const uids = new Set();
const u404s = new Set();
const chkreports = APIParser.batch;
let isRunning = false;

/**@type {HTMLInputElement}}*/
const aloneRec = $("#aloneRec")[0], repeatIn = $("#repeat")[0], wtime = $("#waittime")[0];

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


const bypasser = rec =>
{
    for (const en of Object.entries(rec))
        chkreports[en[0]].push(...en[1]);
    return false;
}

/**
 * @param {string} uid
 */
async function chkUser(uid)
{
    const user = await ContentBase.checkUserState(uid, aloneRec.checked ? bypasser : undefined);
    if (!user)
    {
        u404s.add(uid);
        return;
    }
    users.push(user);
    uids.add(user.id);
    const idx = users.length;
    const newdata = { usr: { id: user.id, name: user.name }, index: idx };
    Object.assign(newdata, user);
    thetable.row.add(newdata);
    thetable.draw(false);
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
    const res = {};
    for (const en of Object.entries(chkreports))
    {
        res[en[0]] = ZhiHuDB.insertfix(en[0], en[1]);
    }
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
        let objs = JSON.parse(txt).filter(uid => !uids.has(uid));
        const banset = isCtrl ? new Set() : (await ContentBase.checkSpam("users", objs)).banned;
        objs = objs.filter(uid => !u404s.has(uid) && !banset.has(uid));

        console.log(`here [${objs.length}] obj users`);
        for (let i = 0; isRunning && i < objs.length; ++i)
        {
            const uid = objs[i];
            chkUser(uid);
            btn.textContent = uid;
            await _sleep(Number(wtime.value));
        }
        isRunning = false;
        btn.textContent = "完毕";
        if (repeatIn.checked)
        {
            uids.clear();
            $("#go")[0].click();
        }
    }
    catch (e)
    {
        console.warn(e);
        isRunning = false;
    }
});


