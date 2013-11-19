const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/HelperApps.jsm");

function loadIntoWindow(window) {
  if (!window)
    return;

  Services.obs.addObserver(HTTP_on_modify_request, "http-on-modify-request", false);
  if (window.HelperApps)
    HelperApps = window.HelperApps;
}

function unloadFromWindow(window) {
  if (!window)
    return;

  Services.obs.removeObserver(HTTP_on_modify_request, "http-on-modify-request");
}

function HTTP_on_modify_request(aSubject, aTopic, aData) {
  let channel = aSubject.QueryInterface(Ci.nsIHttpChannel);
  let window = getWindowForRequest(channel);
  if (!window || window.top != window)
    return;

  let apps = HelperApps.getAppsForUri(channel.URI);
  if (apps.length > 0) {
    try {
      if (HelperApps.launchUri) {
        HelperApps.launchUri(channel.URI);
      } else if (HelperApps.openUriInApp) {
        HelperApps.openUriInApp(channel.URI);
      }
      channel.cancel(Cr.NS_BINDING_ABORTED);
    } catch(ex) {
      Services.console.logStringMessage(ex);
    }
  }
}

function getWindowForRequest(aRequest) {
  let loadContext = getRequestLoadContext(aRequest);
  if (loadContext) {
    try {
      return loadContext.associatedWindow;
    } catch (e) {
      // loadContext.associatedWindow can throw when there's no window
    }
  }
  return null;
}

function getRequestLoadContext(aRequest) {
  if (aRequest && aRequest.notificationCallbacks) {
    try {
      return aRequest.notificationCallbacks.getInterface(Ci.nsILoadContext);
    } catch (ex) { }
  }

  if (aRequest && aRequest.loadGroup && aRequest.loadGroup.notificationCallbacks) {
    try {
      return aRequest.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext);
    } catch (ex) { }
  }

  return null;
}

var windowListener = {
  onOpenWindow: function(aWindow) {
    // Wait for the window to finish loading
    let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener("load", function() {
      domWindow.removeEventListener("load", arguments.callee, false);
      loadIntoWindow(domWindow);
    }, false);
  },
  
  onCloseWindow: function(aWindow) {
  },
  
  onWindowTitleChange: function(aWindow, aTitle) {
  }
};

function startup(aData, aReason) {
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    loadIntoWindow(domWindow);
  }
}

function shutdown(aData, aReason) {
  if (aReason == APP_SHUTDOWN)
    return;

  try {
    Services.wm.removeListener(windowListener);
  } catch(ex) { }

  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  }
}

function install(aData, aReason) {
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    loadIntoWindow(domWindow);
  }
}

function uninstall(aData, aReason) {
  Services.console.logStringMessage("uninstall");
}
