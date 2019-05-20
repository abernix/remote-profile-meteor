import { Meteor } from "meteor/meteor";
import { WebApp } from "meteor/webapp";
import { readdirSync, writeFileSync, statSync, createReadStream } from "fs";
import { join, relative } from "path";
import { parse } from "url";

import profiler from "v8-profiler";

Meteor.startup(() => {
  setupProfilingTools();
});

// See README.md for additional details.
function setupProfilingTools() {
  const cwd = process.cwd();
  const sourceDir = join(cwd, "../../.");
  const urlPrefix = "/__perf";

  const pathDownload = join(urlPrefix, "/downloads");
  const pathStart = join(urlPrefix, "/start");
  const pathStop = join(urlPrefix, "/stop");

  const getDownloadUrl = file => Meteor.absoluteUrl(join(pathDownload, file));

  let profiling = false;

  WebApp.rawConnectHandlers.use(pathStart, (_req, res) => {
    if (profiling) {
      console.error("Profiling is already active.");
      return res.end("Already started.");
    }

    try {
      profiling = true;
      profiler.startProfiling();
      console.debug("CPU profiling has started.  Stop it with", Meteor.absoluteUrl(pathStop));
      return res.end("Started");
    } catch (err) {
      profiling = false;
      console.error("Could not start CPU profiling.", err);
      return res.end("Error.  See server logs.");
    }
  });

  WebApp.rawConnectHandlers.use(pathStop, (_req, res) => {
    let cpuProfile;
    if (!profiling) {
      console.error("Must start profiling before it can be stopped.");
      return res.end("Cannot stop.");
    }

    const cleanProfileMaybe = () =>
      cpuProfile &&
      typeof cpuProfile.delete === "function" &&
      cpuProfile.delete();

    const outputFilename = "captured-" + new Date().getTime() + ".cpuprofile";
    const urlDownloadFile = getDownloadUrl(outputFilename);

    try {
      cpuProfile = profiler.stopProfiling();
      profiling = false;
      console.debug(
        `Stopped CPU profiling.  Visit ${urlDownloadFile} to download newly`,
        `generated profile or visit ${Meteor.absoluteUrl(pathDownload)} to`,
        "list other CPU profiles."
      );
    } catch (err) {
      console.error("Could not stop CPU profiling.", err);
      cleanProfileMaybe();
      return res.end("Error.  See server logs.");
    }

    try {
      writeFileSync(
        join(sourceDir, "/" + outputFilename),
        JSON.stringify(cpuProfile)
      );
    } catch (err) {
      console.error("Could not save or serialize CPU profile.", err);
      cleanProfileMaybe();
      return res.end("Error.  See server logs.");
    }

    cleanProfileMaybe();
    return res.end("Stopped");
  });

  // The filename is the number of milliseconds since Jan 1, 1970 at write time.
  // It should only be 13 digits between now and 2286. :)
  const fileMatcher = /^captured-[0-9]{13}.cpuprofile$/;
  WebApp.rawConnectHandlers.use(pathDownload, (req, res, next) => {
    console.info(
      "Profile download request received.",
      "Disable this functionality when no longer necessary!"
    );

    // Parse the URL and figure out if they"ve specified a specific file.
    const parsedUrl = parse(req.originalUrl);
    const desiredFile = relative(pathDownload, parsedUrl.pathname);

    // If they didn"t specify a file, print a list of available options to the
    // server"s console.  This should at least provide some semblance of
    // protection since the filenames are generated based on V8 internals.
    if (!desiredFile) {
      let files;
      try {
        files = readdirSync(sourceDir)
          .filter(file => fileMatcher.test(file))
          .map(getDownloadUrl);

        if (!files.length) {
          console.warn(
            "No files are available.  Be sure to generate a CPU profile using",
            `the ${pathStart} endpoint, prior to attempting a download.`
          );
        } else {
          console.debug("Available files:\n  -", files.join("\n  - "));
        }
      } catch (err) {
        console.error("Could not read CPU profile source directory.");
      } finally {
        return res.end("See server logs for details.");
      }
    }

    if (!fileMatcher.test(desiredFile)) {
      console.warn("Invalid filename format: ", desiredFile);
      return next();
    }

    try {
      const file = join(sourceDir, desiredFile);
      const stat = statSync(file);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-length": stat.size
      });
      createReadStream(file, "utf8").pipe(res);
    } catch (err) {
      console.warn("CPU profile download not found.");
      return next();
    }
  });
}
