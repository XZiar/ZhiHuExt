"use strict"

/**@type {User[]}}*/
const users = [];
const uids = new Set();
const u404s = new Set();

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
 * @param {string} uid
 */
async function chkUser(uid)
{
    const user = await ContentBase.checkUserState(uid);
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
    if ((idx % 2) === 0)
        thetable.draw(false);
}


$(document).on("click", "#refresh", e =>
{
    thetable.draw(false);
});
$(document).on("click", "#go", async e =>
{
    const btn = e.target;
    const isCtrl = e.ctrlKey;
    const waitTime = Number($("#waittime")[0].value);

    const txt = $("#userinput")[0].value;
    let objs = JSON.parse(txt).filter(uid => !uids.has(uid));
    const banset = isCtrl ? new Set() : (await ContentBase.checkSpam("users", objs)).banned;
    objs = objs.filter(uid => !u404s.has(uid) && !banset.has(uid));

    console.log(`here [${objs.length}] obj users`);
    for (let i = 0; i < objs.length; ++i)
    {
        const uid = objs[i];
        chkUser(uid);
        btn.textContent = uid;
        await _sleep(waitTime);
    }
    btn.textContent = "开始";
});


