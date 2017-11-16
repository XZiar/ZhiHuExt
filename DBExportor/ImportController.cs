using DBExportor.Pods;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace DBExportor.Controllers
{
    [Route("import")]
    public class ImportController : ControllerBase
    {
        private readonly ILogger<ImportController> LOG;

        public ImportController(ILogger<ImportController> logger)
        {
            LOG = logger;
        }

        [HttpGet("begin")]
        public IActionResult BeginDB()
        {
            if (!CheckAuth())
                return StatusCode(401);
            if (string.IsNullOrEmpty(ObjName))
                return StatusCode(404);
            var fname = $"{Program.DBFolder}/ZhiHuExtDB-{ObjName}.json";
            using (var reader = new JsonTextReader(new StreamReader(System.IO.File.OpenRead(fname))))
            {
                try
                {
                    var db = Serializer.Deserialize<StandardDB>(reader);
                    if (!NewDB(db))
                        return StatusCode(500);
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message);
                    return StatusCode(500);
                }
            }
            GC.Collect(2, GCCollectionMode.Optimized, false, true);
            return Ok("ok");
        }

        [HttpGet("finish")]
        public IActionResult OutputDB([FromQuery]bool shouldKeep = false)
        {
            if (!CheckAuth())
                return StatusCode(401);
            if (!TryGetDB(out var obj))
                return StatusCode(404);

            if (!shouldKeep)
                DelDB();
            return Ok("ok");
        }

        [HttpGet("accept")]
        public IActionResult AcceptRecords([FromQuery]string table, [FromQuery]uint from, [FromQuery]uint limit)
        {
            if (!CheckAuth())
                return StatusCode(401);
            if (!TryGetDB(out var db))
                return StatusCode(404);
            if (!DBExtensions.PodTypeMap.TryGetValue(table, out var tableinfo))
                return StatusCode(400);

            HttpContext.Response.ContentType = "text/plain; charset=utf-8";
            using (var writer = new JsonTextWriter(new StreamWriter(HttpContext.Response.Body)))
            {
                try
                {
                    var list = tableinfo.GetTable(db);
                    var size = tableinfo.GetCount(list);
                    if (from >= size)
                        writer.WriteRaw("[]");
                    else
                    {
                        limit = Math.Min(limit, size - from);
                        var records = list.GetRange((int)from, (int)limit);
                        Serializer.Serialize(writer, records);
                    }
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

        [HttpGet("breakpoint")]
        public void BreakPoint()
        {
            Console.WriteLine($"[break]{DBList}");
        }
    }
}
