interface Window {
  _got?: Tracker;
}

interface TrackingData {
  type: "event" | "page";
  identity: string;
  isTouch: boolean;
  ua: string; // user agent
  event: string;
  category: string;
  referrer: string;
}

//TODO : Is touch device (aka device type)
interface TrackPayload {
  tracking: TrackingData;
  site_id: string;
}

class Tracker {
  private id: string = "";
  private referrer: string = "";
  private site_id: string = "";
  private isTouch: boolean = false;

  constructor(site_id: string, referrer: string) {
    this.site_id = site_id;
    this.referrer = referrer;
    this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    const customId = this.getSession("id");

    if (customId) {
      this.id = customId;
    }
  }

  track(event: string, category: string) {
    const payload: TrackPayload = {
      tracking: {
        type: category === "Page views" ? "page" : "event",
        identity: this.id,
        isTouch: this.isTouch,
        ua: navigator.userAgent,
        event: event,
        category: category,
        referrer: this.referrer,
      },
      site_id: this.site_id,
    };

    this.trackRequest(payload);
  }

  private trackRequest(payload: TrackPayload) {
    const s = JSON.stringify(payload);
    const url = `http://localhost:9876/track?data=${btoa(s)}`;
    const img = new Image();
    img.src = url;
  }

  page(path: string) {
    this.track(path, "Page views");
  }

  identify(customId: string) {
    this.id = customId;
    this.setSession("id", customId);
  }

  private getSession(key: string) {
    let lkey = `__pyrrhos_${key}_`;
    const s = localStorage.getItem(lkey);

    if (!s) return null;
    return JSON.parse(s);
  }

  private setSession(key: string, value: any) {
    let lkey = `__pyrrhos_${key}_`;

    localStorage.setItem(lkey, JSON.stringify(value));
  }
}

((w, d) => {
  const ds = d.currentScript?.dataset;

  if (!ds) {
    console.error("you must have a data-siteid in your script tag");
    return;
  } else if (!ds.siteid) {
    console.error("you must have a data-siteid in your script tag");
    return;
  }

  let externalReferrer = "";
  const ref = d.referrer;

  if (ref && ref.indexOf(`${w.location.protocol}//${w.location.host}`) == 0) {
    externalReferrer = ref;
  }

  const path = w.location.pathname;
  const tracker = new Tracker(ds.siteid, externalReferrer);

  w._got = w._got || tracker;

  tracker.page(path);

  const his = w.history;

  if (his.pushState) {
    const originalFn = his["pushState"];
    his.pushState = function () {
      originalFn.apply(this, arguments);
      tracker.page(w.location.pathname);
    };

    window.addEventListener("popstate", () => {
      tracker.page(w.location.pathname);
    });
  }

  w.addEventListener(
    "hashchange",
    () => {
      tracker.page(d.location.hash);
    },
    false,
  );

  console.info("tracker loaded");
})(window, document);
