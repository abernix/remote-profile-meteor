# Profiling Meteor 1.8 with Native Node.js Tools

This demonstration is meant to show how one might go about setting up the
ability to setup CPU profiling which can be programmatically enabled and
disabled.  The resulting output of these CPU profiles can be loaded into
Chrome Developer Tools and analyzed offline.

## Preface

While the resulting CPU profile is often enlightening, CPU profiling can
actually add additional stress to a CPU, further reducing performance.

It is highly recommended that the CPU profile not be left running for
long periods as it will degrade performance and also result in excessive
additional memory usage (during the CPU profiling) and disk utilization (the
resulting CPU profile, which will grow larger over time).

It's suggested to start with short periods of time (e.g. 30 seconds to one
minute), and increase if not enough clarity was captured in the shorter
profilings.

## Getting started with this demo

* Run `meteor npm install`
* Start `meteor`
* See _Instructions_ below to generate profiles and become comfortable with the
  setup.

## Setup within another project

> Recommended that you play with the demo first, prior to instrumenting in
> another application.

* Run `meteor npm install v8-profiler` in the project.
* Implement the `setupProfilingTools()` method (in `server/main.js`, described
  further in the _Instructions_ below).

## Detailed instructions

This demo provides a `setupProfilingTools()` function which can be called at
server startup.  It introduces three REST-based endpoints to the server:

* `/__perf/start` (note the double-underscore before `perf`!)

  By using this endpoint, for example calling it in the browser, CPU
  profiling via [`v8-profiler`](https://npm.im/v8-profiler) will start. It
  should be stopped after the desired time-window (shorter periods to start
  with are usually better!)

  When the profiling has began, `started` will be output in response. To
  stop, use the next endpoint.

* `/__perf/stop`

  Call this endpoint to stop an already running profile which was previously
  started with `__perf/start`.

* `/__perf/downloads`

  This endpoint is used to download profiles which have been generated.  When
  calling this endpoint directly, **it will print a list of available snapshots
  to the server's console.  It will not return anything to the browser.**

  Consult the server logs to see a list of files, which will be listed with
  the pattern `captured-{unixEpochMilliseconds}.cpuprofile`. To download one
  of these, **append the name to `/__perf/downloads/`. For example, the
  server console may list:

  ```
  Available files:
    - captured-1558355623000.cpuprofile 
  ```

  To download this, visit: `/__perf/downloads/captured-1558355623000.cpuprofile`
  in the browser and it should download to the local computer.

## Inspecting a CPU profile in Chrome Dev Tools

After downloading a CPU profile with the above instructions, the `.cpuprofile`
may be opened in Chrome Developer Tools using the following instructions:

* Open a new window in Chrome type `chrome://inspect`.  This will open Chrome Developer Tools.
* Click on _Open dedicated DevTools for Node_.
* Click on the _Profile_ tab at the top of the DevTools.
* If it's not already selected, click on _Profiles_ in the left menu.
* Click on the _Load_ button on the right panel (which is aside the _Start_ button).
* Select the `.cpuprofile` file downloaded in the previous step.
* Click on the newly loaded CPU profile in the left menu.
* The CPU flame chart should load in the right pane.