using DBExportor.Pods;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace DBExportor.Controllers
{

    [Route("dbfunc")]
    public class DBFuncController : ControllerBase
    {
        private readonly ILogger<DBFuncController> LOG;

        public DBFuncController(ILogger<DBFuncController> logger)
        {
            LOG = logger;
        }

        private Dictionary<string, object> BuildCache(StandardDB db)
        {
            Console.WriteLine($"building cache for {ObjName}");
            var caches = new Dictionary<string, object>();
            {
                Dictionary<uint, int> uidcache = new Dictionary<uint, int>();
                HashSet<uint> banuid = new HashSet<uint>();
                int idx = 0;
                foreach (var user in db.users)
                {
                    uidcache[user.id_] = idx++;
                    if (user.status_ == UserStatus.ban || user.status_ == UserStatus.sban)
                        banuid.Add(user.id_);
                }
                caches["uid-user"] = uidcache;
                caches["banuid"] = banuid;
                LOG.LogInformation($"user's index cache built");
            }
            {
                caches["from-zan"] = db.zans.Zip(Enumerable.Range(0, db.zans.Count), (zan, idx) => (zan.from_, idx)).ToLookup(x => x.from_, x => x.idx);
                caches["to-zan"] = db.zans.Zip(Enumerable.Range(0, db.zans.Count), (zan, idx) => (zan.to, idx)).ToLookup(x => x.to, x => x.idx);
                LOG.LogInformation($"zanart's index cache built");

                caches["from-zanart"] = db.zanarts.Zip(Enumerable.Range(0, db.zanarts.Count), (zan, idx) => (zan.from_, idx)).ToLookup(x => x.from_, x => x.idx);
                caches["to-zanart"] = db.zanarts.Zip(Enumerable.Range(0, db.zanarts.Count), (zan, idx) => (zan.to, idx)).ToLookup(x => x.to, x => x.idx);
                LOG.LogInformation($"zanart's index cache built");
            }
            {
                var dict1 = db.answers.ToDictionary(ans => ans.id, ans => ans.author_);
                caches["ans-author"] = dict1;
                caches["author-ans"] = dict1.ToLookup(kv => kv.Value, kv => kv.Key);
                caches["ans-qst"] = db.answers.ToDictionary(ans => ans.id, ans => ans.question);
                LOG.LogInformation($"answer's index cache built");
                var dict2 = db.articles.ToDictionary(art => art.id, art => art.author_);
                caches["art-author"] = dict2;
                caches["author-art"] = dict1.ToLookup(kv => kv.Value, kv => kv.Key);
                LOG.LogInformation($"article's index cache built");
            }
            GC.Collect(2, GCCollectionMode.Optimized, false, true);
            return caches;
        }

        [HttpGet("begin")]
        public IActionResult BeginDB()
        {
            if (string.IsNullOrEmpty(ObjName))
                return StatusCode(404);
            if (TryGetDB(out var olddb))
                return Ok("ok");
            var fname = $"{Program.DBFolder}/ZhiHuExtDB-{ObjName}.json";
            using (var reader = new JsonTextReader(new StreamReader(System.IO.File.OpenRead(fname))))
            {
                try
                {
                    var db = SlimSerializer.Deserialize<StandardDB>(reader);
                    LOG.LogInformation("json loaded");
                    var banusrcnt = db.users.Where(usr => usr.status_ != UserStatus.empty).Count();
                    LOG.LogInformation($"bans:{banusrcnt}\tspams:{db.spams.Count}\tusers:{db.users.Count}\tzans:{db.zans.Count}\tzanarts:{db.zanarts.Count}");
                    LOG.LogInformation($"questions:{db.questions.Count}\tanswers:{db.answers.Count}\tarticles:{db.articles.Count}\tdetails:{db.details.Count}");
                    db.Slim(1);
                    GC.Collect(2, GCCollectionMode.Optimized, false, true);
                    var cache = BuildCache(db);
                    if (!NewCache(cache) || !NewDB(db)) 
                        return StatusCode(500);
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message, e.StackTrace);
                    return StatusCode(500);
                }
            }
            GC.Collect(2, GCCollectionMode.Optimized, false, true);
            return Ok("ok");
        }

        [HttpPost("special")]
        public IActionResult SpecialGet([FromQuery]string cmd)
        {
            if (!TryGetDB(out var db))
                return StatusCode(404);
            if (!TryGetCache(out var cache))
                return StatusCode(404);

            switch(cmd)
            {
            case "banzancnt":
                {
                    var zanfcache = cache["from-zan"] as ILookup<uint, int>;
                    var zanartfcache = cache["from-zanart"] as ILookup<uint, int>;
                    var banuid = cache["banuid"] as HashSet<uint>;
                    var zansum = banuid.SelectMany(uid => zanfcache[uid]).Count();
                    var zanartsum = banuid.SelectMany(uid => zanartfcache[uid]).Count();
                    return Content($"zanans:{zansum},zanart:{zanartsum},zanall:{zansum + zanartsum}");
                }
            case "banzanqst":
                {
                    var zanfcache = cache["from-zan"] as ILookup<uint, int>;
                    var ansqstcache = cache["ans-qst"] as Dictionary<uint, uint>;
                    var banuid = cache["banuid"] as HashSet<uint>;
                    var qids = banuid.SelectMany(uid => zanfcache[uid])
                        .Select(idx => db.zans[idx].to)
                        .Select(ansid => ansqstcache.TryGetValue(ansid, out var qid) ? qid : int.MaxValue)
                        .Where(qid => qid != int.MaxValue)
                        .GroupBy(x => x)
                        .Select(g => new { key = g.Key, count = g.Count() })
                        .ToArray();
                    return Content(JsonConvert.SerializeObject(qids));
                }
            case "banzanstat":
                {
                    var zanfcache = cache["from-zan"] as ILookup<uint, int>;
                    var zanartfcache = cache["from-zanart"] as ILookup<uint, int>;
                    var banuid = cache["banuid"] as HashSet<uint>;
                    var zanstat = banuid.Select(uid => zanfcache[uid].Concat(zanartfcache[uid]))
                        .Select(zans => zans.Count());
                    return Content(JsonConvert.SerializeObject(zanstat));
                }
            default:
                return StatusCode(404);
            }
        }

        private User[] GetUsers(StandardDB db, Dictionary<string, object> cache, string[] uids)
        {
            if (uids[0] == "#ALL_USER")
                return db.users.ToArray();
            var uidcache = cache["uid-user"] as Dictionary<uint, int>;
            if (uids[0] == "#BAN_UID")
            {
                var banuid = cache["banuid"] as HashSet<uint>;
                return banuid.Select(uid => uidcache.TryGetValue(uid, out var idx) ? idx : -1).Where(x => x >= 0)
                .Select(idx => db.users[idx]).ToArray();
            }
            return uids.Select(uid => UIDPool.Get(uid)).Where(uid => uid != uint.MaxValue)
                .Select(uid => uidcache.TryGetValue(uid, out var idx) ? idx : -1).Where(x => x >= 0)
                .Select(idx => db.users[idx]).ToArray();
        }

        [HttpPost("getAny")]
        public IActionResult DoGetAny()
        {
            if (!TryGetDB(out var db))
                return StatusCode(404);
            if (!TryGetCache(out var cache))
                return StatusCode(404);

            string[] uids;
            using (var reader = new JsonTextReader(new StreamReader(HttpContext.Request.Body)))
            {
                try
                {
                    var args = Serializer.Deserialize<string[]>(reader);
                    if (args[0] == "users" && args[1] == "id")
                        uids = JsonConvert.DeserializeObject<string[]>(args[2]);
                    else
                        return StatusCode(500);
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message);
                    return StatusCode(500);
                }
            }
            HttpContext.Response.ContentType = "text/plain; charset=utf-8";
            using (var writer = new JsonTextWriter(new StreamWriter(HttpContext.Response.Body)))
            {
                try
                {
                    var ret = GetUsers(db, cache, uids);
                    SlimSerializer.Serialize(writer, ret);
                    GC.Collect(2, GCCollectionMode.Optimized, false, true);
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message);
                    return StatusCode(500);
                }
                GC.Collect(2, GCCollectionMode.Optimized, false, true);
                return new EmptyResult();
            }
        }

        private string SomeAssoc(StandardDB db, Dictionary<string, object> cache, string target, IEnumerable<uint> uids)
        {
            var zanfcache = cache["from-zan"] as ILookup<uint, int>;
            var zans = uids.SelectMany(uid => zanfcache[uid]);
            LOG.LogInformation($"we get {zans.Count()} zans");
            var anss = zans.Select(idx=> db.zans[idx].to).GroupBy(x => x);
            var sb = new StringBuilder("[");
            foreach (var ans in anss)
                sb.AppendFormat("{{\"key\":{0},\"count\":{1}}},", ans.Key, ans.Count());
            sb.Remove(sb.Length - 1, 1);
            sb.Append("]");
            return sb.ToString();
        }

        [HttpPost("someAnalyse")]
        public IActionResult SomeAnalyse()
        {
            if (!TryGetDB(out var db))
                return StatusCode(404);
            if (!TryGetCache(out var cache))
                return StatusCode(404);

            string target;
            HashSet<uint> uids;
            using (var reader = new JsonTextReader(new StreamReader(HttpContext.Request.Body)))
            {
                try
                {
                    var args = Serializer.Deserialize<string[]>(reader);
                    target = args[0];
                    var ids = JsonConvert.DeserializeObject<HashSet<string>>(args[1]);
                    uids = ids.Select(uid => UIDPool.Get(uid)).Where(uid => uid != uint.MaxValue).ToHashSet();
                    if (ids.Contains("#BAN_UID"))
                    {
                        var banuid = cache["banuid"] as HashSet<uint>;
                        uids.UnionWith(banuid);
                    }
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message);
                    return StatusCode(500);
                }
            }
            var ret = SomeAssoc(db, cache, target, uids);
            GC.Collect(2, GCCollectionMode.Optimized, false, true);
            return Content(ret, "text/plain; charset=utf-8");
        }

        private string[][] GetZanLinks(StandardDB db, Dictionary<string, object> cache, string[] uids, string target)
        {
            Console.WriteLine($"here get {uids.Length} uids");
            if (target == "to")
            {
                var zanfcache = cache["from-zan"] as ILookup<uint, int>;
                var zanartfcache = cache["from-zanart"] as ILookup<uint, int>;
                var ansathcache = cache["ans-author"] as Dictionary<uint, uint>;
                var artathcache = cache["art-author"] as Dictionary<uint, uint>;

                var zanans = uids.SelectMany(uid =>
                {
                    var id = UIDPool.Get(uid);
                    if (id == uint.MaxValue)
                        return Enumerable.Empty<string[]>();
                    return zanfcache[id].Select(idx =>
                    {
                        ansathcache.TryGetValue(db.zans[idx].to, out var ath);
                        return new string[] { uid, UIDPool.GetString(ath) };
                    });
                }).Where(pair => pair[1] != null);
                var zanart = uids.SelectMany(uid =>
                {
                    var id = UIDPool.Get(uid);
                    if (id == uint.MaxValue)
                        return Enumerable.Empty<string[]>();
                    return zanartfcache[id].Select(idx =>
                    {
                        artathcache.TryGetValue(db.zanarts[idx].to, out var ath);
                        return new string[] { uid, UIDPool.GetString(ath) };
                    });
                }).Where(pair => pair[1] != null);
                return zanans.Concat(zanart).ToArray();
            }
            else if (target == "from")
            {
                var athanscache = cache["author-ans"] as ILookup<uint, uint>;
                var athartcache = cache["author-art"] as ILookup<uint, uint>;
                var zantcache = cache["to-zan"] as ILookup<uint, int>;
                var zanarttcache = cache["to-zanart"] as ILookup<uint, int>;

                var zanans = uids.SelectMany(uid =>
                {
                    var id = UIDPool.Get(uid);
                    if (id == uint.MaxValue)
                        return Enumerable.Empty<string[]>();
                    return athanscache[id].SelectMany(ansid => zantcache[ansid])
                        .Select(idx => new string[] { db.zans[idx].from, uid });
                });
                var zanart = uids.SelectMany(uid =>
                {
                    var id = UIDPool.Get(uid);
                    if (id == uint.MaxValue)
                        return Enumerable.Empty<string[]>();
                    return athanscache[id].SelectMany(artid => zanarttcache[artid])
                        .Select(idx => new string[] { db.zanarts[idx].from, uid });
                });
                return zanans.Concat(zanart).ToArray();
            }
            else return null;
        }

        [HttpPost("getZanLinks")]
        public IActionResult DoGetZanLinks()
        {
            if (!TryGetDB(out var db))
                return StatusCode(404);
            if (!TryGetCache(out var cache))
                return StatusCode(404);

            string target;
            string[] uids;
            using (var reader = new JsonTextReader(new StreamReader(HttpContext.Request.Body)))
            {
                try
                {
                    var args = Serializer.Deserialize<string[]>(reader);
                    target = args[1];
                    uids = JsonConvert.DeserializeObject<string[]>(args[0]);
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message);
                    return StatusCode(500);
                }
            }
            HttpContext.Response.ContentType = "text/plain; charset=utf-8";
            using (var writer = new JsonTextWriter(new StreamWriter(HttpContext.Response.Body)))
            {
                try
                {
                    var ret = GetZanLinks(db, cache, uids, target);
                    Serializer.Serialize(writer, ret);
                    GC.Collect(2, GCCollectionMode.Optimized, false, true);
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message);
                    return StatusCode(500);
                }
                GC.Collect(2, GCCollectionMode.Optimized, false, true);
                return new EmptyResult();
            }
        }
    }
}