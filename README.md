# Description
This module lets you manipulate time flow inside a JavaScript program.
# Installation
## With `browserify`
If your project uses `browserify` as a way to assemble a script file to include it in HTML page, you can install this module using `npm`:
```
npm install timevirtualizer
```
After that, you just need to add
```
require('timevirtualizer');
```
into your script file.
## Without `browserify`
If your project does not use `browserify`, you can just clone this repo:
```
git clone https://github.com/yanenkoa/jstimevirtualizer.git
```
and then include `lib/assembledTimeVirtualizer.js` in your HTML page.
# Usage
TimeVirtualizer script should be included on the page ASAP because it needs to track all the time related calls on the page.

After including the module with one of those two ways, you are able to access `timeVirtualizer` object, which belongs to `window` object.

## API

* **`timeVirtualizer.virtualize()`** — enable time virtualization. This need to be executed before any of the time manipulation. This will overload the following functions:
  * `setTimeout`, `clearTimeout`
  * `setInterval`, `clearInterval`
  * `requestAnimationFrame`, `cancelAnimationFrame`

  All the timeouts, intervals and animation requests created after **OR** before calling that metod will obey virtualized time. All the timeouts, intervals and animation requests will retain their IDs.
* **`timeVirtualizer.unVirtualize()`** — disable time virtualization. All the timeouts, which have not fired yet, will behave as if there were no virtualization in the first place. All the intervals and animation requests will behave as if there were no virtualization since their last call. All the timeouts, intervals and animation requests will retain their IDs.
* **`timeVirtualizer.advanceMS(durationMS)`** — advance virtual time by `durationMS` milliseconds. After virtual time is advanced, all the operations, which should have been done in that time interval, are performed.
* **`timeVirtualizer.getVirtTSMS()`** — get virtual timestamp in milliseconds. This is the equivalent of `Date.now()` function for virtual time.
* **`timeVirtualizer.realDateNow()`** — get real timestamp in milliseconds.
