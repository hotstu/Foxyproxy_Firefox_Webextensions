$(document).foundation();

document.addEventListener("DOMContentLoaded", function() {
  let upgraded = Utils.urlParamsToJsonMap().upgraded;
  console.log("is upgraded? " + upgraded);
  if (upgraded) {
    $(".hide-if-upgrade").hide();
    $(".hide-if-not-upgrade").show();
  }
  else {
    $(".hide-if-upgrade").show();
    $(".hide-if-not-upgrade").hide();
  }
});

$(document).on("click", "#cancelBtn", function() {
  location = "/proxies.html";
});

$(document).on("change", "#importJson", function(evt) {
  Utils.importFile(evt.target.files[0], ["text/plain", "application/json"], 1024*1024*50 /* 50 MB */, "json", importJson);
});

function importJson(settings) {
  deleteAllSettings().then(() => writeAllSettings(settings).then(() =>
    {alert("Import finished"); location = "/proxies.html";}));
}

$(document).on("change", "#importXml1,#importXml2", function(evt) {
  Utils.importFile(evt.target.files[0], ["text/plain", "application/xml", "text/xml"], 1024*1024*50 /* 50 MB */, "xml", importXml);
});

$(document).on("click", "#export", () => {
  Utils.exportFile();
});

/**
  Example new proxy setting:

  "ye3ikc1508098264080": {
    "title": "test",
    "type": 3,
    "color": "#66cc66",
    "address": "123.123.123.123",
    "port": 9999,
    "username": "eric",
    "password": "jung",
    "active": true,
    "whitePatterns": [
      {
        "title": "all URLs",
        "active": true,
        "pattern": "*",
        "type": 1,
        "protocols": 1
      }
    ],
    "blackPatterns": [
      {
        "title": "localhost URLs",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?(?:localhost|127\\.\\d+\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "protocols": 1
      },
      {
        "title": "internal IP addresses",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?(?:192\\.168\\.\\d+\\.\\d+|10\\.\\d+\\.\\d+\\.\\d+|172\\.(?:1[6789]|2[0-9]|3[01])\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "protocols": 1
      },
      {
        "title": "localhost hostnames",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?[\\w-]+(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "protocols": 1
      }
    ],
    "index": 0
  }


example old proxy setting:

<proxy name="Work" id="2922082020" notes="PAC at work" enabled="true" mode="direct" selectedTabIndex="2" lastresort="false" animatedIcons="true" includeInCycle="true" color="#D6657F" proxyDNS="true"><matches><match enabled="true" name="leahscape" pattern="*://leahscape.com/*" isRegEx="false" isBlackList="false" isMultiLine="false" caseSensitive="false"/></matches><autoconf url="http://192.168.1.1/proxy.pac" loadNotification="true" errorNotification="true" autoReload="true" reloadFreqMins="60" disableOnBadPAC="true"/>
  <manualconf host="ny.bbc.pac" port="8118" socksversion="5" isSocks="false"/>
</proxy>

<proxy name="Default" id="2653187683" notes="These are the settings that are used when no patterns match a URL." fromSubscription="false" enabled="true" mode="manual" selectedTabIndex="1" lastresort="true" animatedIcons="false" includeInCycle="true" color="#0055E5" proxyDNS="true" noInternalIPs="false" autoconfMode="pac" clearCacheBeforeUse="false" disableCache="false" clearCookiesBeforeUse="false" rejectCookies="false">
  <matches><match enabled="true" name="All" pattern="*" isRegEx="false" isBlackList="false" isMultiLine="false" caseSensitive="false" fromSubscription="false"/></matches>
  <autoconf url="" loadNotification="true" errorNotification="true" autoReload="false" reloadFreqMins="60" disableOnBadPAC="true"/><autoconf url="http://wpad/wpad.dat" loadNotification="true" errorNotification="true" autoReload="false" reloadFreqMins="60" disableOnBadPAC="true"/>
  <manualconf host="foo.com" port="1111" socksversion="5" isSocks="false" isHttps="true" username="eric" password="jung" domain=""/>
</proxy>
*/
function importXml(oldSettings) {
    // Log it
    let serializer = new XMLSerializer();
    //console.log("******");
    //console.log(serializer.serializeToString(oldSettings));
    //console.log("******");
    let newSettings = {};
    let oldMode = oldSettings.evaluate("//foxyproxy/@mode", oldSettings, null, XPathResult.ANY_TYPE, null).iterateNext().value;
    let lastResortFound = false, badModes = [];
    console.log("old mode is " + oldMode);
    newSettings[MODE] = convertOldMode(oldMode);
    console.log("new mode is " + newSettings[MODE]);
/*

<manualconf host="test.getfoxyproxy.org" port="2313" socksversion="5" isSocks="false" isHttps="false" username="" password="" domain=""/>
*/

    let proxies = oldSettings.getElementsByTagName("proxy"), patternsEdited = false;
    for (let i = 0; i<proxies.length; i++) {
      let oldProxySetting = proxies[i], newProxySetting = {};
      // type a.k.a. mode
      let oldType = oldProxySetting.getAttribute("mode");
      if (oldType == "system") {
        badModes.push(oldProxySetting);
        newProxySetting.type = PROXY_TYPE_SYSTEM;
      }
      else if (oldType == "auto") {
        badModes.push(oldProxySetting);
        if (oldProxySetting.getAttribute("autoconfMode") == "pac") {
          newProxySetting.type = PROXY_TYPE_PAC;
          let autoconf = oldProxySetting.getElementsByTagName("autoconf")[0];
          newProxySetting.pacURL = autoconf.getAttribute("url");
        }
        else {
          // wpad
          newProxySetting.type = PROXY_TYPE_WPAD;
          newProxySetting.pacURL = "http://wpad/wpad.dat";
        }
      }
      else if (oldType == "direct") newProxySetting.type = PROXY_TYPE_NONE;
      else if (oldType == "manual") {
        let manualconf = oldProxySetting.getElementsByTagName("manualconf")[0];
        newProxySetting.address = manualconf.getAttribute("host");
        newProxySetting.port = parseInt(manualconf.getAttribute("port"));
        newProxySetting.username = manualconf.getAttribute("username");
        newProxySetting.password = manualconf.getAttribute("password");
        // There appears to be a bug in 4.6.5 and possibly earlier versions: socksversion is always 5, never 4
        if (manualconf.getAttribute("isSocks") == "true") {
          newProxySetting.type = PROXY_TYPE_SOCKS5;
          console.log("proxyDNS: " + oldProxySetting.getAttribute("proxyDNS"));
          console.log("proxyDNS: " + (oldProxySetting.getAttribute("proxyDNS") == "true"));
          if (oldProxySetting.getAttribute("proxyDNS") == "true") newProxySetting.proxyDNS = true;
        }
        else if (manualconf.getAttribute("isHttps") == "true") newProxySetting.type = PROXY_TYPE_HTTPS;
        else newProxySetting.type = PROXY_TYPE_HTTP;
      }
      newProxySetting.title = oldProxySetting.getAttribute("name");
      console.log("title: " + newProxySetting.title);
      newProxySetting.color = oldProxySetting.getAttribute("color");

      // Deactivate from patterns mdoe any unsupported types/modes
      if (oldType != "manual" && oldType != "direct") {
        newProxySetting.active = false;
      }
      else newProxySetting.active = oldProxySetting.getAttribute("enabled") == "true";

      let newId, oldId = oldProxySetting.getAttribute("id");
      if (oldProxySetting.getAttribute("lastresort") == "true") {
        lastResortFound = true;
        newId = LASTRESORT; // This is a string
        newProxySetting.index = Number.MAX_SAFE_INTEGER;
        if (oldType != "manual" && oldType != "direct")
          newProxySetting.type = PROXY_TYPE_NONE; 
      }
      else {
        newProxySetting.index = i;
        newId = "import-" + oldId; // Force it to a string
      }

      if (newSettings[MODE] == oldId) {
        // If the old top-level mode points to a proxy setting with an unsupported mode (e.g. WPAD),
        // we have to change the new top-level mode otherwise nothing will work w/o user intervention
        if (oldType != "manual" && oldType != "direct")
          newSettings[MODE] = PROXY_TYPE_NONE;
        else
          newSettings[MODE] = newId; // Update mode to the new id ("import-" prefix)
      }

      newProxySetting.whitePatterns = [];
      newProxySetting.blackPatterns = [];
      let matches = oldProxySetting.getElementsByTagName("match");
      for (let j = 0; j<matches.length; j++) {
        let oldMatch = matches[j], newPattern = {};
        /*
          "whitePatterns": [
            {
              "title": "all URLs",
              "active": true,
              "pattern": "*",
              "type": 1,
              "protocols": 1
            }
          ]  

        */
          newPattern.title = oldMatch.getAttribute("name");
          //console.log("name? " + oldMatch.getAttribute("name"));
          newPattern.active = oldMatch.getAttribute("enabled") == "true";
          newPattern.importedPattern = newPattern.pattern = oldMatch.getAttribute("pattern");
          //console.log("enabled? " + oldMatch.getAttribute("enabled"));
          newPattern.type = oldMatch.getAttribute("isRegEx") == "true" ? PATTERN_TYPE_REGEXP : PATTERN_TYPE_WILDCARD;
          // Do some simple parsing but only for wildcards. Anything else is going to fail.
          if (newPattern.type == PATTERN_TYPE_WILDCARD) {
            if (newPattern.pattern.startsWith("http://")) {
              newPattern.protocols = PROTOCOL_HTTP;
              newPattern.pattern = newPattern.pattern.substring(7);
            }
            else if (newPattern.pattern.startsWith("https://")) {
              newPattern.protocols = PROTOCOL_HTTPS;
              newPattern.pattern = newPattern.pattern.substring(8);
            }
            else if (newPattern.pattern.startsWith("*://")) {
              newPattern.protocols = PROTOCOL_ALL;
              newPattern.pattern = newPattern.pattern.substring(4);
            }
            else newPattern.protocols = PROTOCOL_ALL;
            // Clip everything after slashes; it can't be used anymore: https://bugzilla.mozilla.org/show_bug.cgi?id=1337001
            let idx = newPattern.pattern.indexOf("/");
            if (idx > -1) {
              newPattern.pattern = newPattern.pattern.substring(0, idx);
              patternsEdited = true;
            }
          }
          else { // e.g. ^https?://(?:[^:@/]+(?::[^@/]+)?@)?(?:localhost|127\.\d+\.\d+\.\d+)(?::\d+)?(?:/.*)?$
            if (newPattern.pattern.indexOf("^https?://") == 1) {
              newPattern.pattern = "^" + newPattern.pattern.substring(10);
              newPattern.protocols = PROTOCOL_ALL;
            }
            else if (newPattern.pattern.indexOf("^http://") == 1) {
              newPattern.pattern = "^" + newPattern.pattern.substring(8);
              newPattern.protocols = PROTOCOL_HTTP;
            }
            else if (newPattern.pattern.indexOf("^https://") == 1) {
              newPattern.pattern = "^" + newPattern.pattern.substring(9);
              newPattern.protocols = PROTOCOL_HTTPS;
            }  
            else newPattern.protocols = PROTOCOL_ALL;          
          }
          if (oldMatch.getAttribute("isBlackList") == "true") newProxySetting.blackPatterns.push(newPattern);
          else newProxySetting.whitePatterns.push(newPattern);
      }
      newSettings[newId] = newProxySetting;
    }
    if (!lastResortFound) newSettings[LASTRESORT] = JSON.parse(JSON.stringify(DEFAULT_PROXY_SETTING));
    //console.log("Converted settings:");
    //console.log(JSON.stringify(newSettings));
    //console.log("Done");
    deleteAllSettings().then(() => writeAllSettings(newSettings, false).then(() => {
      //Utils.displayNotification("Import finished");
      if (patternsEdited)
        alert("Some patterns were changed because they contained slashes. Slashes in patterns are not supported because of a Firefox bug. Please review your patterns to be sure the edits are acceptable.");
      else
        alert("Import finished. Slashes in patterns are not supported because of a Firefox bug. Please review your patterns and remove slashes, if any.");
      location = "/proxies.html";
    }));
}


/**
  const PATTERNS = 1;
  const DISABLED = 16;
*/
function convertOldMode(oldMode) {
  switch (oldMode) {
    case "patterns": return PATTERNS;
    case "disabled": return DISABLED;
    default: return oldMode;
  }
}