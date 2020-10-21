import { DI, IDisposable } from '@aurelia/kernel';
import { IDOM } from '@aurelia/runtime';

const defaultOptions: AddEventListenerOptions = {
  capture: false,
};

class ListenerTracker implements IDisposable {
  private count: number = 0;
  private readonly captureLookups: Map<EventTarget, Record<string, EventListenerOrEventListenerObject | undefined>> = new Map();
  private readonly bubbleLookups: Map<EventTarget, Record<string, EventListenerOrEventListenerObject | undefined>> = new Map();

  public constructor(
    private readonly publisher: EventTarget,
    private readonly eventName: string,
    private readonly options: AddEventListenerOptions = defaultOptions,
  ) {
    this.handleEvent = this.handleEvent.bind(this);
  }

  public increment(): void {
    if (++this.count === 1) {
      this.publisher.addEventListener(this.eventName, this.handleEvent, this.options);
    }
  }

  public decrement(): void {
    if (--this.count === 0) {
      this.publisher.removeEventListener(this.eventName, this.handleEvent, this.options);
    }
  }

  public dispose(): void {
    if (this.count > 0) {
      this.count = 0;
      this.publisher.removeEventListener(this.eventName, this.handleEvent, this.options);
    }
    this.captureLookups.clear();
    this.bubbleLookups.clear();
  }

  /** @internal */
  public getLookup(target: EventTarget): Record<string, EventListenerOrEventListenerObject | undefined> {
    let lookups = this.options.capture === true ? this.captureLookups : this.bubbleLookups;
    let lookup = lookups.get(target);
    if (lookup === void 0) {
      lookups.set(target, lookup = Object.create(null) as Record<string, EventListenerOrEventListenerObject | undefined>);
    }
    return lookup;
  }

  private handleEvent(event: Event): void {
    const lookups = this.options.capture === true ? this.captureLookups : this.bubbleLookups;
    const path = event.composedPath();
    if (this.options.capture === true) {
      path.reverse();
    }
    for (const target of path) {
      const lookup = lookups.get(target);
      if (lookup === void 0) {
        continue;
      }
      const listener = lookup[this.eventName];
      if (listener === void 0) {
        continue;
      }
      if (typeof listener === 'function') {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
      if (event.cancelBubble === true) {
        return;
      }
    }
  }
}


/**
 * Enable dispose() pattern for `delegate` & `capture` commands
 */
export class DelegateSubscription implements IDisposable {
  public constructor(
    private readonly tracker: ListenerTracker,
    private readonly lookup: Record<string, EventListenerOrEventListenerObject | undefined>,
    private readonly eventName: string,
    callback: EventListenerOrEventListenerObject
  ) {
    tracker.increment();
    lookup[eventName] = callback;
  }

  public dispose(): void {
    this.tracker.decrement();
    this.lookup[this.eventName] = void 0;
  }
}

export interface IEventSubscriber extends IDisposable {
  subscribe(node: Node, callbackOrListener: EventListenerOrEventListenerObject): void;
}

export class EventSubscriber implements IEventSubscriber {
  private target: Node = null!;
  private handler: EventListenerOrEventListenerObject = null!;

  public constructor(
    private readonly dom: IDOM,
    private readonly events: string[],
  ) {}

  public subscribe(node: Node, callbackOrListener: EventListenerOrEventListenerObject): void {
    this.target = node;
    this.handler = callbackOrListener;

    const add = this.dom.addEventListener;
    const events = this.events;

    for (let i = 0, ii = events.length; ii > i; ++i) {
      add(events[i], callbackOrListener, node);
    }
  }

  public dispose(): void {
    const node = this.target;
    const callbackOrListener = this.handler;
    const events = this.events;
    const dom = this.dom;

    for (let i = 0, ii = events.length; ii > i; ++i) {
      dom.removeEventListener(events[i], callbackOrListener, node);
    }

    this.target = this.handler = null!;
  }
}

export interface IEventManager extends EventManager {}
export const IEventManager = DI.createInterface<IEventManager>('IEventManager').withDefault(x => x.singleton(EventManager));

export class EventManager implements IDisposable {
  private readonly trackerMaps: Record<string, Map<EventTarget, ListenerTracker> | undefined> = Object.create(null);

  public constructor() { /* do not remove, is necessary for fulfilling the TS (new() => ...) type */ }

  public addEventListener(
    publisher: EventTarget,
    target: Node,
    eventName: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ): IDisposable {
    const trackerMap = this.trackerMaps[eventName] ??= new Map<EventTarget, ListenerTracker>();
    let tracker = trackerMap.get(publisher);
    if (tracker === void 0) {
      trackerMap.set(publisher, tracker = new ListenerTracker(publisher, eventName, options));
    }
    return new DelegateSubscription(tracker, tracker.getLookup(target), eventName, listener);
  }

  public dispose(): void {
    for (const eventName in this.trackerMaps) {
      const trackerMap = this.trackerMaps[eventName]!;
      for (const tracker of trackerMap.values()) {
        tracker.dispose();
      }
      trackerMap.clear();
    }
  }
}
