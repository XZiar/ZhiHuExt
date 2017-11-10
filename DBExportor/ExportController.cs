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
    [Route("export")]
    public class ExportController : ControllerBase
    {
        private readonly ILogger<ExportController> LOG;

        public ExportController(ILogger<ExportController> logger)
        {
            LOG = logger;
        }

        [HttpGet("begin")]
        public IActionResult BeginDB()
        {
            if (!CheckAuth())
                return StatusCode(401);
            if (!NewDB())
                return StatusCode(500);
            return Ok("ok");
        }

        [HttpGet("finish")]
        public IActionResult OutputDB()
        {
            if (!CheckAuth())
                return StatusCode(401);
            if (!TryGetDB(out var obj))
                return StatusCode(404);
            var fname = $"{Program.DBFolder}/ZhihuDB{ObjName}.json";
            using (StreamWriter file = System.IO.File.CreateText(fname))
            {
                Serializer.Serialize(file, obj);
                return Ok("ok");
            }
        }

        [HttpPost("accept")]
        public IActionResult AcceptRecords([FromQuery]string table)
        {
            if (!CheckAuth())
                return StatusCode(401);
            if (!TryGetDB(out var obj))
                return StatusCode(404);
            if (!DBExtensions.GetPodType(table, out var type, out var listtype))
                return StatusCode(400);

            using (var reader = new JsonTextReader(new StreamReader(HttpContext.Request.Body)))
            {
                try
                {
                    var records = Serializer.Deserialize(reader, listtype);
                    AddMore(obj, table, records);
                }
                catch(Exception e)
                {
                    LOG.LogError(e.Message);
                }
            }
            GC.Collect(2, GCCollectionMode.Forced, false, true);
            return Ok("ok");
        }

        [HttpGet("breakpoint")]
        public void BreakPoint()
        {
            Console.WriteLine($"[break]{DBList}");
        }
    }
}
