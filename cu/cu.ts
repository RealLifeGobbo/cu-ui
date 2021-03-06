﻿/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/// <reference path="../vendor/jquery.d.ts" />
/// <reference path="../vendor/strophe.d.ts" />

// Keep in sync with Race enum on client and server
enum Race {
    //Tuatha = 0,
    Hamadryad = 1,
    Luchorpan = 2,
    Firbog = 3,

    Valkyrie = 4,
    Helbound = 5,
    FrostGiant = 6,
    //Dvergr = 7,

    Strm = 8,
    CaitSith = 9,
    Golem = 10,
    //Gargoyle = 11

    StormRiderA = 12,
    StormRiderT = 13,
    StormRiderV = 14
}

enum Archetype {
    FireMage = 0,
    EarthMage = 1,
    WaterMage = 2,
    Fighter = 3,
    Healer = 4,
    MeleeCombatTest = 5
}

enum AbilityTags {
    SYSTEM = 0,      // Used for abilities applied outside the ability system. e.g. No movement stat mod while casting.
    NonAggressive,   // Used for effects that should affect caster and/or allies.
    NonInteractable, // Can't interact or be interacted with

    // Non-elemental
    NoMagic,

    // 
    Weapon,
    Style,
    Speed,
    Potential,
    Targeting,

    // Vocal
    Voice,
    Shout,
    Inflection,

    // Primary elemental magics
    Air,
    Earth,
    Fire,
    Water,

    // Secondary elemental magics
    Blast,
    Lava,
    Mud,
    Sand,
    Steam,
    Spray,

    // Non-elemental magics
    Healing,
    Restoration,
    Lifedrain,
    Swiftness,
    Dispalcement,

    // Shape
    Self,
    Direct,
    Touch,
    Dart,
    Ball,
    Cloud,
    Fountain,
    Wall,
    Wave,
    Pool,
    Cone,

    // Meta types
    Rune,
    Shape,
    Range,
    Size,
    Infusion,
    Focus,

    // Combat tags
    Blocking,
    CounterAttack,
    Unblockable,

    COUNT           // Total number of tags.  Do not use as a tag.
}

enum TagConstraintType {
    AllOf,
    AnyOf,
    NoneOf,
}

class Ability {
    id: string;
    icon: string;
    cooldowns: CooldownGroup[] = [];
    duration: number;
    triggerTimeOffset: number;
    name: string;
    tooltip: string;

    buttons: AbilityButton[] = [];
    awaitingUpdate: { (a: Ability): any }[] = null;

    constructor(private cu: CU) {
    }

    MakeButton(index): AbilityButton {
        var button = new AbilityButton(this, this.cu, index);
        this.buttons.push(button);
        return button;
    }

    Perform(): void {
        if (this.cu.gameClientReady) {
            this.cu.gameClient.Attack(this.id);
        }
    }

    UpdateButtons(): void {
        for (var i = 0, len = this.buttons.length; i < len; ++i) {
            var b = this.buttons[i];
            b.UpdateVisuals();
        }
    }

    HandleCooldownChanged(c: CooldownGroup): void {
        if (!this.CurrentlyRunning()) this.UpdateButtons();
    }

    SetAsActive(startTime: number, triggerTime: number): void {
        if (triggerTime < 0.0) triggerTime = startTime + this.triggerTimeOffset;
        if (startTime != this.startWorldTime || triggerTime != this.triggerWorldTime) {
            this.startWorldTime = startTime;
            this.triggerWorldTime = triggerTime;
            this.endWorldTime = triggerTime + this.duration - this.triggerTimeOffset;
            this.UpdateButtons();
        }
    }

    ClearAsActive(): void {
        this.SetAsActive(-1, -1);
    }

    CurrentlyRunning(): boolean {
        return this.startWorldTime > 0.0 &&
            this.triggerWorldTime >= this.startWorldTime &&
            this.triggerWorldTime + (this.duration - this.triggerTimeOffset) > this.cu.ServerTime();
    }

    OnCooldown(): boolean {
        for (var i = 0, len = this.cooldowns.length; i < len; ++i) {
            var c = this.cooldowns[i];
            if (c.Active()) return true;
        }
        return false;
    }

    CooldownTimeLeft(): number {
        var result = 0.0;
        for (var i = 0, len = this.cooldowns.length; i < len; ++i) {
            var c = this.cooldowns[i];
            if (c.duration > 0.0) {
                var t = this.cu.ServerTime() - (c.startTime + c.duration);
                if (t > result) result = t;
            }
        }
        return result;
    }

    startWorldTime: number = -1.0;
    triggerWorldTime: number = -1.0;
    endWorldTime: number;
}


class CooldownGroup {
    constructor(public id: number, private cu: CU) {
    }

    abilities: Ability[] = [];

    startTime: number;
    duration: number = 0.0;

    Active() {
        return this.duration > 0.0 && this.startTime + this.duration > this.cu.ServerTime();
    }

    Set(newStart: number, newDuration: number) {
        if (newStart === this.startTime && newDuration === this.duration) return;

        var wasActive = this.Active();
        this.startTime = newStart;
        this.duration = newDuration;
        if (wasActive || this.Active()) {
            for (var i = 0, len = this.abilities.length; i < len; ++i) {
                var a = this.abilities[i];
                a.HandleCooldownChanged(this);
            }
        }
    }
}


class AbilityButton {
    constructor(public ability: Ability, private cu: CU, private index) {
        this.rootElement = $('<div/>').addClass('abilityButton').attr('data-id', ability.id).mousedown(() => ability.Perform());
        this.rootElement.append($('<img/>').addClass('activeHighlight').attr('src', '../images/skillbar/active-frame.gif'));
        this.rootElement.append($('<img/>').addClass('abilityIcon').attr('src', ability.icon));
        this.rootElement.append($('<img/>').addClass('queuedIcon').attr('src', '../images/skillbar/queued-frame.png'));
        var $key = $('<span>').addClass('key').appendTo(this.rootElement);
        var keyBindName = 'Ability ' + (index + 1);

        cu.GetConfigVar(keyBindName);

        cu.Listen('HandleReceiveConfigVar', (configVar) => {
            if (configVar && configVar.hasOwnProperty(keyBindName)) {
                var key = KeyCode.dxKeyCodeMap[configVar[keyBindName]];
                if (key) {
                    $key.text(key);
                }
            }
        });

        cu.Listen('HandleSavedConfigChanges', () => {
            cu.GetConfigVar(keyBindName);
        });

        this.UpdateVisuals();
    }

    Remove(): void {
        var index = this.ability.buttons.indexOf(this);
        if (index >= 0) {
            this.ability.buttons.splice(index, 1);
        }
        this.rootElement.detach();
    }

    UpdateVisuals(): void {
        if (this.cooldownOverlay) {
            this.cooldownOverlay.detach();
            this.cooldownOverlay = null;
        }

        this.rootElement.attr('queued', this.cu.queuedAbility === this.ability ? 1 : 0);

        if (this.ability.CurrentlyRunning()) {
            if (Math.abs(this.activeStartTime - this.ability.startWorldTime) > 0.1) {
                this.activeStartTime = this.ability.startWorldTime;
                window.setTimeout(() => this.UpdateVisuals(), 1000 * (this.ability.endWorldTime - this.cu.ServerTime()) + 17);
            }
            this.rootElement.attr('running', 1);
            this.rootElement.attr('cooldown', 0);
            return; // bail and don't apply cooldowns if we're running
        } else {
            if (this.activeOverlay) {
                this.activeOverlay.detach();
                this.activeOverlay = null;
            }

            this.rootElement.attr('running', 0);

            this.activeStartTime = -1;
        }

        var cooldown = null;

        for (var i = 0, len = this.ability.cooldowns.length; i < len; ++i) {
            var c = this.ability.cooldowns[i];
            if (c.Active() && (!cooldown || c.duration > cooldown.duration)) {
                cooldown = c;
            }
        }

        if (cooldown) {
            var frac = (this.cu.ServerTime() - cooldown.startTime) / cooldown.duration;
            var timeLeft = (1.0 - frac) * cooldown.duration;
            if (timeLeft > 0.02) {
                if (!this.cooldownOverlay) {
                    this.cooldownOverlay = $('<div>').addClass('cooldownRoot').appendTo(this.rootElement);
                }

                var slide = $('<div>').addClass('cooldownSlide').css('height', Math.round(frac * 100.0) + '%').appendTo(this.cooldownOverlay);

                slide.animate({ height: '100%' }, timeLeft * 1000.0, 'linear', () => this.UpdateVisuals());
            }
        }

        this.rootElement.attr('cooldown', (cooldown ? 1 : 0));
    }

    rootElement: JQuery;
    private activeStartTime: number = -1;
    private activeOverlay: JQuery = null;
    private cooldownOverlay: JQuery = null;
}


class CallbackSet {
    private nextKey = 0;
    constructor(private prefix: string) {
    }

    AddCallback(callback: () => any, oneTimeOnly: boolean): string {
        var key = this.prefix + ++this.nextKey;
        if (callback) {
            this[key] = { func: callback, once: oneTimeOnly };
        }
        return key;
    }

    CancelCallback(key: string) {
        if (this.hasOwnProperty(key) && key != 'prefix' && key != 'nextKey') {
            delete this[key];
        }
    }

    InvokeCallbacks(): void {
        for (var key in this) {
            if (this.hasOwnProperty(key) && key != 'prefix' && key != 'nextKey') {
                var c = this[key];
                c.func();
                if (c.once) {
                    delete this[key];
                }
            }
        }
    }
}


interface ServerAbility {
    id: string;
    icon: string;
    cooldowns?: number[];
    duration: number;
    triggerTime: number;
    name: string;
    tooltip: string;
}


enum XmppMessageType {
    NORMAL = -1,
    ERROR = 0,
    CHAT = 1,
    GROUPCHAT = 2,
    HEADLINE = 3
}


enum XmppRoomStatus {
    UNKNOWN = -1,
    NON_ANONYMOUS_JOIN = 100,
    AFILLIATION_CHANGE = 101,
    SHOW_UNAVAILABLE = 102,
    NO_SHOW_UNAVAILABLE = 103,
    PRIVACY_CHANGE = 104,
    SELF = 110,
    LOGGING_ENABLED = 170,
    LOGGING_DISABLED = 171,
    NON_ANONYMOUS = 172,
    SEMI_ANONYMOUS = 173,
    ANONYMOUS = 174,
    CREATED = 201,
    NICK_CHANGED = 210,
    BANNED = 301,
    NEW_NICK = 303,
    KICKED = 307,
    REMOVED_AFFILIATION = 321,
    REMOVED_NONMEMBER = 322,
    REMOVED_SHUTDOWN = 332,
}

enum XmppAuthMechanism {
    PLAIN,
    CSELOGINTOKEN
}

// These are the tags needed by the C++ Layer to know which build variables to send to the window.
enum Tags {
    KEYBIND = 2,
    INPUT = 6
}

// This determines which mode of building the UI is currently in.
enum BuildUIMode {
    NotBuilding = 0,
    PlacingPhantom = 1,
    PhantomPlaced = 2,
    SelectingBlock = 4,
    BlockSelected = 8
}

var KeyCode = {
    getKeyCodeFromEvent: e => {
        var keycode = null;
        if (window.event) {
            keycode = window.event.keyCode;
        } else if (e) {
            keycode = e.which;
        }
        return keycode;
    },

    getKeyCodeValueFromEvent: e => {
        var keycode = KeyCode.getKeyCodeFromEvent(e);
        if (keycode) {
            return KeyCode.jsKeyCodeMap[keycode];
        }
        return null;
    },

    dxKeyCodeMap: {
        0x01: 'ESCAPE',
        0x02: '1',
        0x03: '2',
        0x04: '3',
        0x05: '4',
        0x06: '5',
        0x07: '6',
        0x08: '7',
        0x0B: '0',
        0x0C: '-',
        0x0D: '=',
        0x0E: 'BACK',
        0x0F: 'TAB',
        0x10: 'Q',
        0x11: 'W',
        0x12: 'E',
        0x15: 'Y',
        0x16: 'U',
        0x17: 'I',
        0x18: 'O',
        0x19: 'P',
        0x1A: 'LBRACKET',
        0x1B: 'RBRACKET',
        0x1C: 'RETURN',
        0x1D: 'CONTROL',
        0x1E: 'A',
        0x1F: 'S',
        0x20: 'D',
        0x21: 'F',
        0x22: 'G',
        0x23: 'H',
        0x24: 'J',
        0x27: 'SEMICOLON',
        0x28: 'APOSTROPHE',
        0x29: 'GRAVE',
        0x2A: 'SHIFT',
        0x2B: 'BACKSLASH',
        0x2C: 'Z',
        0x2D: 'X',
        0x14: 'T',
        0x2E: 'C',
        0x2F: 'V',
        0x30: 'B',
        0x31: 'N',
        0x32: 'M',
        0x33: 'COMMA',
        0x34: 'PERIOD',
        0x35: 'SLASH',
        0x37: 'MULTIPLY',
        0x38: 'ALT',
        0x39: 'SPACE',
        0x3A: 'CAPITAL',
        0x3B: 'F1',
        0x3C: 'F2',
        0x3D: 'F3',
        0x3E: 'F4',
        0x3F: 'F5',
        0x40: 'F6',
        0x41: 'F7',
        0x42: 'F8',
        0x43: 'F9',
        0x44: 'F10',
        0x45: 'NUMLOCK',
        0x46: 'SCROLL',
        0x48: 'NUMPAD8',
        0x49: 'NUMPAD9',
        0x4A: 'SUBTRACT',
        0x4B: 'NUMPAD4',
        0x4C: 'NUMPAD5',
        0x4D: 'NUMPAD6',
        0x4E: 'ADD',
        0xDC: 'RWIN',
        0x4F: 'NUMPAD1',
        0x50: 'NUMPAD2',
        0x51: 'NUMPAD3',
        0x52: 'NUMPAD0',
        0x53: 'DECIMAL',
        0x56: 'OEM_102',
        0x57: 'F11',
        0x47: 'NUMPAD7',
        0x58: 'F12',
        0x64: 'F13',
        0x65: 'F14',
        0x66: 'F15',
        0x70: 'KANA',
        0x73: 'ABNT_C1',
        0x79: 'CONVERT',
        0x7B: 'NOCONVERT',
        0x7D: 'YEN',
        0x7E: 'ABNT_C2',
        0x8D: 'NUMPADEQUALS',
        0x90: 'PREVTRACK',
        0x91: 'AT',
        0x92: 'COLON',
        0x93: 'UNDERLINE',
        0x36: 'SHIFT',
        0x94: 'KANJI',
        0x95: 'STOP',
        0x96: 'AX',
        0x97: 'UNLABELED',
        0x99: 'NEXTTRACK',
        0x9C: 'NUMPADENTER',
        0x9D: 'CONTROL',
        0x26: 'L',
        0xA0: 'MUTE',
        0xA1: 'CALCULATOR',
        0xA2: 'PLAYPAUSE',
        0xA4: 'MEDIASTOP',
        0xAE: 'VOLUMEDOWN',
        0xB0: 'VOLUMEUP',
        0xB2: 'WEBHOME',
        0x25: 'K',
        0xB3: 'NUMPADCOMMA',
        0xB5: 'DIVIDE',
        0xB7: 'SYSRQ',
        0xB8: 'ALT',
        0xC5: 'PAUSE',
        0xC7: 'HOME ',
        0xC8: 'UP',
        0xC9: 'PAGEUP',
        0xCB: 'LEFT',
        0xCD: 'RIGHT',
        0xCF: 'END',
        0xD0: 'DOWN',
        0xD1: 'PAGEDN',
        0xD2: 'INSERT',
        0xD3: 'DELETE',
        0xDB: 'LWIN',
        0xDD: 'APPS',
        0xDE: 'POWER',
        0xDF: 'SLEEP',
        0xE3: 'WAKE',
        0xE5: 'WEBSEARCH',
        0xE6: 'WEBFAVORITES',
        0xE7: 'WEBREFRESH',
        0xE8: 'WEBSTOP',
        0xE9: 'WEBFORWARD',
        0xEA: 'WEBBACK',
        0xEB: 'MYCOMPUTER',
        0xEC: 'MAIL',
        0xED: 'MEDIASELECT',
        0x09: '8',
        0x13: 'R',
        0x0A: '9',
    },

    jsKeyCodeMap: {
        8: 0x0E,
        9: 0x0F,
        13: 0x1C,
        16: 0x2A | 0x36, // javascript only detects 'Shift' so we OR lshift and rshift
        17: 0x1D | 0x9D, // CTRL
        18: 0x38 | 0xB8, // ALT
        19: 0xC5,
        20: 0x3A,
        27: 0x01,
        32: 0x39,
        33: 0xC9,   // also NUM_NORTH_EAST
        34: 0xD1,   // also NUM_SOUTH_EAST
        35: 0xCF,
        36: 0xC7,
        37: 0xCB,
        38: 0xC8,
        39: 0xCD,
        40: 0xD0,
        //PRINT_SCREEN: 44,
        45: 0xD2,
        46: 0xD3,
        //0 - 9
        48: 0x0B,
        49: 0x02,
        50: 0x03,
        51: 0x04,
        52: 0x05,
        53: 0x06,
        54: 0x07,
        55: 0x08,
        56: 0x09,
        57: 0x0A,
        //A - Z
        65: 0x1E,
        66: 0x30,
        67: 0x2E,
        68: 0x20,
        69: 0x12,
        70: 0x21,
        71: 0x22,
        72: 0x23,
        73: 0x17,
        74: 0x24,
        75: 0x25,
        76: 0x26,
        77: 0x32,
        78: 0x31,
        79: 0x18,
        80: 0x19,
        81: 0x10,
        82: 0x13,
        83: 0x1F,
        84: 0x14,
        85: 0x16,
        86: 0x2F,
        87: 0x11,
        88: 0x2D,
        89: 0x15,
        90: 0x2C,
        91: 0xDB,
        92: 0xDC,
        //CONTEXT_MENU: 93,
        // NUMPAD0-9
        96: 0x52,
        97: 0x4F,
        98: 0x50,
        99: 0x51,
        100: 0x4B,
        101: 0x4C,
        102: 0x4D,
        103: 0x47,
        104: 0x48,
        105: 0x49,
        // NUMPAD special keys
        106: 0x37,
        107: 0x4E,
        109: 0x4A,
        110: 0x53,
        111: 0xB5,
        // f1-f12
        112: 0x3B,
        113: 0x3C,
        114: 0x3D,
        115: 0x3E,
        116: 0x3F,
        117: 0x40,
        118: 0x41,
        119: 0x42,
        120: 0x43,
        121: 0x44,
        122: 0x57,
        123: 0x58,
        144: 0x45,
        145: 0x46,

        // OS-specific media keys like volume controls and browser controls.
        0xA6: 0xEA, // WEB_BACK
        0xA7: 0xE9, // WEB_FORWARD
        0xA8: 0xE7, // WEB_REFRESH
        0xA9: 0xE8, // WEB_STOP
        0xAA: 0xE5, // WEB_SEARCH
        0xAB: 0xE6, // WEB_FAVORITES
        0xAC: 0xB2, // WEB_HOME
        0xAD: 0xA0, // WEB_MUTE
        0xAE: 0xAE, // Volume Down key
        0xAF: 0xB0, // Volume Up key
        0xB0: 0x99, // Next Track key
        0xB1: 0x90, // Previous Track key
        0xB2: 0xA4, // Stop Media key
        0xB3: 0xA2, // Play/Pause Media key
        0xB4: 0xEC, // Start Mail key
        0xB5: 0xED, // Select Media key
        //    0xB6: ????, // Start Application 1 key
        //    0xB7: ????, // Start Application 2 key

        186: 0x27,
        189: 0x0C,
        187: 0x0D,
        188: 0x33,
        190: 0x34,
        191: 0x35,
        192: 0x29,
        222: 0x28,
        219: 0x1A,
        220: 0x2B,
        221: 0x1B,
    },

    jsModifiedByShift: {
        192: '~',
        48: ')',
        49: '!',
        50: '@',
        51: '#',
        52: '$',
        53: '%',
        54: '^',
        55: '&',
        56: '*',
        57: '(',
        109: '_',
        61: '+',
        219: '{',
        221: '}',
        220: '|',
        59: ':',
        222: '\'',
        188: '<',
        189: '>',
        191: '?',
        96: 'insert',
        97: 'end',
        98: 'down',
        99: 'pagedown',
        100: 'left',
        102: 'right',
        103: 'home',
        104: 'up',
        105: 'pageup'
    }
};


class JID {
    public user: string = '';
    public domain: string = '';
    public resource: string = '';

    constructor(unparsed: string) {
        // JIDs should be in the format of user@domain/resource (tim@cse.com/Trillian)
        var chopped: Array<string> = unparsed.split(/[@]/);
        if (chopped.length == 0) return;
        if (chopped.length == 1) {
            this.domain = chopped[0];
        } else if (chopped.length > 1) {
            this.user = chopped[0];
            chopped = chopped[1].split(/[\/]/);
            if (chopped.length > 0) this.domain = chopped[0];
            if (chopped.length > 1) this.resource = chopped[1];
        }
    }

    public HasUser(): boolean {
        return this.user && this.user !== '';
    }

    public HasDomain(): boolean {
        return this.domain && this.domain !== '';
    }

    public HasResource(): boolean {
        return this.resource && this.resource !== '';
    }

    public EnsureHasUser(): void {
        if (!this.HasUser()) throw new Error('jid user required');
    }

    public EnsureHasDomain(): void {
        if (!this.HasDomain()) throw new Error('jid domain required');
    }

    public EnsureHasResource(): void {
        if (!this.HasResource()) throw new Error('jid resource required');
    }
}


class CU {
    constructor(initCallback?: () => any,
        connectedCallback?: () => any) {

        this.OnInitialized(initCallback);
        this.OnServerConnected(connectedCallback);

        if (this.HasAPI()) {
            this.gameClient = cuAPI;
            var myCallback = () => {
                this.ready = true;
                this.gameClientReady = true;

                if (_.isFunction(this.gameClient.OnAbilityCooldown)) {
                    this.gameClient.OnAbilityCooldown((c, t, d) => this.HandleAbilityCooldown(c, t, d));
                }

                if (_.isFunction(this.gameClient.OnAbilityActive)) {
                    this.gameClient.OnAbilityActive((curr, start, trigger, queue) => {
                        if (curr) curr = parseInt(curr, 16).toString(16);
                        if (queue) queue = parseInt(queue, 16).toString(16);
                        this.HandleAbilityActive((curr ? cu.abilities[curr] : null), start, trigger, (queue ? cu.abilities[queue] : null));
                    });
                }

                if (_.isFunction(this.gameClient.OnAbilityError)) {
                    this.gameClient.OnAbilityError((message) => this.Fire('HandleAbilityError', message));
                }

                if (_.isFunction(this.gameClient.OnReceiveConfigVars)) {
                    this.gameClient.OnReceiveConfigVars((configs) => this.Fire('HandleReceiveConfigVars', configs));
                }

                if (_.isFunction(this.gameClient.OnReceiveConfigVar)) {
                    this.gameClient.OnReceiveConfigVar((config) => this.Fire('HandleReceiveConfigVar', config));
                }

                if (_.isFunction(this.gameClient.OnConfigVarChanged)) {
                    this.gameClient.OnConfigVarChanged((isChangeSuccessful) => this.Fire('HandleConfigVarChanged', isChangeSuccessful));
                }

                if (_.isFunction(this.gameClient.OnSavedConfigChanges)) {
                    this.gameClient.OnSavedConfigChanges(() => this.Fire('HandleSavedConfigChanges'));
                }

                if (_.isFunction(this.gameClient.OnBuildingModeChanged)) {
                    this.gameClient.OnBuildingModeChanged((buildingMode) => this.Fire('HandleBuildingModeChanged', buildingMode));
                }

                if (_.isFunction(this.gameClient.OnReceiveBlocks)) {
                    this.gameClient.OnReceiveBlocks((buildingDict) => this.Fire('HandleReceiveBlocks', buildingDict));
                }

                this.onInit.InvokeCallbacks();

                this.gameServerURL = this.gameClient.serverURL;
                if (this.gameServerURL) {
                    this.onServerConnected.InvokeCallbacks();
                } else {
                    if (_.isFunction(this.gameClient.OnServerConnected)) {
                        this.gameClient.OnServerConnected(() => {
                            this.gameServerURL = this.gameClient.serverURL;
                            this.onServerConnected.InvokeCallbacks();
                        });
                    }
                }
            };

            if (this.gameClient.initialized) {
                myCallback();
            } else {
                this.gameClient.OnInitialized(myCallback);
            }
        } else {
            var self = this;

            $(() => {
                self.ready = true;
                self.onInit.InvokeCallbacks();
            });
        }
    }

    /* Begin Constants */
    public CHAT_DOMAIN = 'chat.camelotunchained.com';
    public CHAT_SERVICE = 'conference.' + this.CHAT_DOMAIN;
    public GLOBAL_CHATROOM_NAME = '_global';
    public COMBAT_CHATROOM_NAME = '_combat';
    public CUBE_CHATROOM_NAME = '_cube';
    public GLOBAL_CHATROOM = this.GLOBAL_CHATROOM_NAME + '@' + this.CHAT_SERVICE;
    public COMBAT_CHATROOM = this.COMBAT_CHATROOM_NAME + '@' + this.CHAT_SERVICE;
    public CUBE_CHATROOM = this.CUBE_CHATROOM_NAME + '@' + this.CHAT_SERVICE;

    private WEB_API_HOST = 'chat.camelotunchained.com';
    private WEB_API_PORT = 8000;
    private CHAT_API_PORT = 8222;

    private XMPP_SASL = 'urn:ietf:params:xml:ns:xmpp-sasl';
    private XMPP_BIND = 'urn:ietf:params:xml:ns:xmpp-bind';

    // matches Emote enum in AnimatableInterface.h
    public Emote =
    {
        Dance1: 0,
        Dance2: 1,
        Wave1: 2,
        Wave2: 3,

        // Always last and not counted in EMOTE_COUNT
        Stop: 4,
        None: 5
    };

    /* End Constants */

    /* Begin Variables */
    ready = false;
    gameClient: CUInGameAPI = null;
    gameClientReady = false;
    public forceWebSocketChat = false;
    private onInit = new CallbackSet('onInit');
    private listeners = {};
    private webSocket: WebSocket = null;
    private idCounter: number = 0;
    private isAuthed: boolean = false;
    private isBound: boolean = false;
    private currentJid: JID = null;
    private roomSelfPresences: Array<string> = [];
    /* End Variables */

    OnInitialized(c: () => any) {
        if (this.ready) {
            c();
        } else {
            this.onInit.AddCallback(c, true);
        }
    }

    HasAPI(): boolean {
        return typeof cuAPI !== 'undefined';
    }

    ApiUrl(action): string {
        // TODO: this also needs to handle checking whether we're connected or not
        if (this.HasAPI()) return 'cuapi://server/api/' + action;
        return 'http://localhost:8000/api/' + action;
    }

    ApiHost(): string {
        return this.HasAPI() && cuAPI.webAPIHost ? cuAPI.webAPIHost : 'hatchery.camelotunchained.com';
    }

    SecureApiUrl(action: string): string {
        var host = this.ApiHost();
        var isLocalhost = host === 'localhost';
        var protocol = isLocalhost ? 'http' : 'https';
        var port = isLocalhost ? '8000' : '4443';
        return protocol + '://' + host + ':' + port + '/' + action;
    }

    InGame(): boolean {
        return this.gameClient !== null;
    }

    timeStarted = Date.now();
    private gameServerURL: string = null;
    private onServerConnected = new CallbackSet('onServerConnected');

    OnServerConnected(c: () => any) {
        if (this.gameServerURL) {
            c();
        } else {
            this.onServerConnected.AddCallback(c, true);
        }
    }

    SetDebugServer(serverURL?: string) {
        if (!this.gameClient) {
            if (!serverURL) serverURL = 'http://localhost:8000/api/';
            this.gameServerURL = serverURL;
            this.OnInitialized(() => this.onServerConnected.InvokeCallbacks());
        }
    }

    ServerTime(): number {
        if (this.gameClientReady) {
            return this.gameClient.serverTime;
        } else if (this.gameClient) {
            return 0.0;
        } else {
            return (Date.now() - this.timeStarted) / 1000.0;
        }
    }

    // Respawn
    Respawn(id) {
        if (this.InGame()) {
            this.gameClient.Respawn(id);
        }
    }

    abilities: { [id: string]: Ability } = {};
    cooldowns: { [id: number]: CooldownGroup } = {};
    private allAbilitiesCallback: { (a: Ability[]): any }[];

    HandleAbilityCooldown(cooldownID: number, timeStarted: number, duration: number) {
        var c = this.cooldowns[cooldownID];
        if (!c) {
            this.cooldowns[cooldownID] = c = new CooldownGroup(cooldownID, this);
        }
        c.Set(timeStarted, duration);
    }

    RequestAbility(id: string, callback: (a: Ability) => any, force: boolean): void {
        var current = this.abilities[id];

        if (current && !current.awaitingUpdate && !force) {
            callback(current);
        } else {
            if (!current) {
                current = this.abilities[id] = new Ability(this);
                current.id = id;
            }
            if (!current.awaitingUpdate) {
                current.awaitingUpdate = [callback];
            } else {
                current.awaitingUpdate.push(callback);
            }
            $.getJSON('http://' + this.ApiHost() + ':8000/api/abilities/' + parseInt(id, 16), (data) => this.UpdateAbility(data));
        }
    }

    RequestAllAbilities(loginToken, characterID, callback: (a: Ability[]) => any) {
        if (!loginToken || !characterID) return null;

        if (!this.allAbilitiesCallback) {
            this.allAbilitiesCallback = [callback];
            return $.getJSON(cu.SecureApiUrl('api/craftedabilities'), {
                loginToken: loginToken,
                characterID: characterID
            });
        } else {
            this.allAbilitiesCallback.push(callback);
        }
    }

    public UpdateAbility(rawAbility: ServerAbility): Ability {
        var a = new Ability(this);
        a.id = parseInt(rawAbility.id, 16).toString(16);
        a.icon = rawAbility.icon;
        if (rawAbility.cooldowns) {
            for (var i = 0; i < rawAbility.cooldowns.length; ++i) {
                var cooldownID = rawAbility.cooldowns[i];
                var c = this.cooldowns[cooldownID];
                if (!c) {
                    this.cooldowns[cooldownID] = c = new CooldownGroup(cooldownID, this);
                }
                if (a.cooldowns.indexOf(c) === -1) {
                    c.abilities.push(a);
                    a.cooldowns.push(c);
                }
            }
        }
        a.duration = rawAbility.duration;
        a.triggerTimeOffset = rawAbility.triggerTime;
        a.name = rawAbility.name;
        a.tooltip = rawAbility.tooltip;

        var old = this.abilities[a.id];
        this.abilities[a.id] = a;

        if (old) {
            for (var i = 0; i < old.cooldowns.length; ++i) {
                var index = old.cooldowns[i].abilities.indexOf(old);
                if (index >= 0) {
                    old.cooldowns[i].abilities.splice(index, 1);
                }
            }
            a.buttons = old.buttons;
            for (var i = 0; i < a.buttons.length; ++i) {
                a.buttons[i].ability = a;
            }
            a.SetAsActive(old.startWorldTime, old.triggerWorldTime);
            if (old.awaitingUpdate) {
                for (var i = 0; i < old.awaitingUpdate.length; ++i) {
                    old.awaitingUpdate[i](a);
                }
            }
        }
        return a;
    }

    public UpdateAllAbilities(rawList: ServerAbility[]) {
        var convertedList = <Ability[]><any>rawList;
        var oldAbilities = <{ [id: string]: Ability }>$.extend({}, this.abilities);
        for (var i = 0, len = rawList.length; i < len; ++i) {
            var a = convertedList[i] = this.UpdateAbility(rawList[i]);
            delete oldAbilities[a.id];
        }
        for (var id in oldAbilities) {
            delete this.abilities[id];
        }
        if (this.allAbilitiesCallback) {
            for (i = 0, len = this.allAbilitiesCallback.length; i < len; ++i) {
                this.allAbilitiesCallback[i](convertedList);
            }
            this.allAbilitiesCallback = null;
        }
    }

    public HandleAbilityActive(current: Ability, startTime: number, triggerTime: number, queued: Ability) {
        var updatedCurrent = false;
        var oldCurrent = this.currentAbility;
        var oldQueued = this.queuedAbility;
        console.log('HandleAbilityActive newCurr=' + (current ? current.id : 'null') + ' oldCurr=' + (oldCurrent ? oldCurrent.id : 'null') + ' newQ=' + (queued ? queued.id : 'null') + ' oldQ=' + (oldQueued ? oldQueued.id : 'null'));
        this.currentAbility = current;
        this.queuedAbility = queued;
        if (current !== oldCurrent ||
            (current && (startTime != current.startWorldTime ||
            triggerTime >= 0.0 && triggerTime != current.triggerWorldTime))) {
            updatedCurrent = true;
            if (current) current.SetAsActive(startTime, triggerTime);
            if (oldCurrent && oldCurrent !== current) oldCurrent.ClearAsActive();
        }
        if (queued != oldQueued) {
            if (queued && !(updatedCurrent && (queued === current || queued === oldCurrent))) {
                queued.UpdateButtons();
            }
            if (oldQueued && !(updatedCurrent && (oldQueued === current || oldQueued === oldCurrent))) {
                oldQueued.UpdateButtons();
            }
        }
    }

    currentAbility: Ability = null;
    queuedAbility: Ability = null;

    public RunAtInterval(callback: () => void, updateFPS: number = 5): number {
        if (updateFPS > 0) {
            callback();
            return window.setInterval(callback, 1000 / updateFPS);
        }
    }

    public FindElement(selector: string, context?: Element): JQuery {
        var $element: JQuery = $(selector, context);
        if (!$element.length) throw new Error(selector + ' required');
        return $element;
    }

    public GetConfigVar(variable: string): void {
        if (cu.HasAPI()) {
            cuAPI.GetConfigVar(variable);
        }
    }

    public GetConfigVars(tag: Tags): void {
        if (cu.HasAPI()) {
            cuAPI.GetConfigVars(tag);
        }
    }

    public ChangeConfigVar(variable, value): void {
        if (cu.HasAPI()) {
            cuAPI.ChangeConfigVar(variable, value);
        }
    }

    public CancelChangeConfig(variable): void {
        if (cu.HasAPI()) {
            cuAPI.CancelChangeConfig(variable);
        }
    }

    public SaveConfigChanges(): void {
        if (cu.HasAPI()) {
            cuAPI.SaveConfigChanges();
        }
    }

    public CancelAllConfigChanges(tag): void {
        if (cu.HasAPI()) {
            cuAPI.CancelAllConfigChanges(tag);
        }
    }

    public RestoreConfigDefaults(tag): void {
        if (cu.HasAPI()) {
            cuAPI.RestoreConfigDefaults(tag);
        }
    }

    public ToggleBuildingMode(): void {
        if (cu.HasAPI()) {
            cuAPI.ToggleBuildingMode();
        }
    }

    public SetBuildingMode(newMode): void {
        if (cu.HasAPI()) {
            cuAPI.SetBuildingMode(newMode);
        }
    }

    public RequestBlocks(): void {
        if (cu.HasAPI()) {
            cuAPI.RequestBlocks();
        }
    }

    public ChangeBlockType(newType): void {
        if (cu.HasAPI()) {
            cuAPI.ChangeBlockType(newType);
        }
    }

    public CommitBlock(): void {
        if (cu.HasAPI()) {
            cuAPI.CommitBlock();
        }
    }

    public CancelBlockPlacement(): void {
        if (cu.HasAPI()) {
            cuAPI.CancelBlockPlacement();
        }
    }

    public BlockRotateX(): void {
        if (cu.HasAPI()) {
            cuAPI.BlockRotateX();
        }
    }

    public BlockRotateY(): void {
        if (cu.HasAPI()) {
            cuAPI.BlockRotateY();
        }
    }

    public BlockRotateZ(): void {
        if (cu.HasAPI()) {
            cuAPI.BlockRotateZ();
        }
    }

    public BlockFlipX(): void {
        if (cu.HasAPI()) {
            cuAPI.BlockFlipX();
        }
    }

    public BlockFlipY(): void {
        if (cu.HasAPI()) {
            cuAPI.BlockFlipY();
        }
    }

    public BlockFlipZ(): void {
        if (cu.HasAPI()) {
            cuAPI.BlockFlipZ();
        }
    }

    public Fire(event: string, ...args: any[]) {
        if (this.listeners.hasOwnProperty(event)) {
            this.listeners[event].forEach(function (listener) {
                listener.apply(this, args);
            });
        }
    }

    public Listen(event: string, callback: Function) {
        if (!this.listeners.hasOwnProperty(event)) {
            this.listeners[event] = [];
        }

        this.listeners[event].push(callback);
    }

    public GetFactionCssClassName(factionValue: number): string {
        switch (factionValue) {
            case 3: return 'arthurian';
            case 2: return 'viking';
            case 1: return 'tdd';
            default: return 'factionless';
        }
    }

    public GetFactionName(factionValue: number): string {
        switch (factionValue) {
            case 3: return 'Arthurian';
            case 2: return 'Viking';
            case 1: return 'Tuatha De Danann';
            default: return 'Factionless';
        }
    }

    public GetFactionChannel(factionValue: number): string {
        switch (factionValue) {
            case 3: return '_arthurian';
            case 2: return '_viking';
            case 1: return '_tuatha';
            default: return null;
        }
    }

    public GetPlayerName(player: any): string {
        var name = player.name;
        if (!name) this.GetFactionName(player.faction);
        return _.escape(name);
    }

    public JoinMUC(room): void {
        if (cu.HasAPI()) {
            cuAPI.JoinMUC(room);
        }
    }

    public LeaveMUC(room): void {
        if (cu.HasAPI()) {
            cuAPI.LeaveMUC(room);
        }
    }

    public SendChat(messageType, room, input): void {
        if (!cu.forceWebSocketChat && cu.HasAPI()) {
            cuAPI.SendChat(messageType, room, input);
        } else {
            this.SendWebSocketChatMessage(messageType, room, input);
        }
    }

    public ConsoleCommand(body): void {
        if (cu.HasAPI()) cuAPI.ConsoleCommand(body);
    }

    public RequestInputOwnership(): void {
        if (cu.HasAPI()) cuAPI.RequestInputOwnership();
    }

    public ReleaseInputOwnership(): void {
        if (cu.HasAPI()) cuAPI.ReleaseInputOwnership();
    }

    public DestroyWebSocket() {
        if (this.webSocket) {
            this.webSocket.close();

            this.webSocket = null;
        }
    }

    public CreateWebSocket(loginToken: string, domain: string, boundCallback: () => void, presenceCallback: () => void) {
        var self: CU = this;

        if (!loginToken) {
            return null;
        }

        this.webSocket = new WebSocket('ws://' + this.WEB_API_HOST + ':' + this.CHAT_API_PORT + '/api/chat', 'xmpp');

        this.webSocket.onopen = e => {
            console.log('onopen', e);

            // open stream
            self.SendWebSocketMessage(self.$openStream({ hasOpenXmlTag: true, to: domain }));
        };

        this.webSocket.onmessage = e => {
            var xmlDoc = self.ParseXml(e.data);

            switch (xmlDoc.documentElement.nodeName) {
                case 'stream:stream':
                    console.log('stream:stream response', xmlDoc.documentElement);
                    break;
                case 'stream:features':
                    console.log('stream:features response', xmlDoc.documentElement);

                    // close stream when navigating away from page
                    $(window).unload(() => {
                        if (self.HasOpenWebSocket()) {
                            self.SendWebSocketMessage(self.$closeStream());
                        }
                    });

                    var features = xmlDoc.documentElement;

                    if (!self.isAuthed) {
                        var mechanisms = features.getElementsByTagName('mechanism');

                        var hasCseLoginTokenMechanism = false;

                        for (var i = 0, length = mechanisms.length; i < length; i++) {
                            var mechanism = self.GetElementNodeValue(mechanisms[i]);
                            if (mechanism === XmppAuthMechanism[1 /* CSELOGINTOKEN */]) {
                                hasCseLoginTokenMechanism = true;

                                break;
                            }
                        }

                        if (hasCseLoginTokenMechanism) {
                            self.SendWebSocketMessage(self.$auth({ loginToken: loginToken, mechanism: XmppAuthMechanism[1 /* CSELOGINTOKEN */] }));
                        }
                    } else {
                        var bind = self.GetFirstElement(features.getElementsByTagName('bind'));

                        if (bind && bind.getAttribute('xmlns') === self.XMPP_BIND) {
                            self.SendWebSocketMessage($iq({ type: 'set', id: self.GetNextId() }).c('bind', { xmlns: self.XMPP_BIND }));
                        }
                    }

                    break;
                case 'failure':
                    console.log('failure response', xmlDoc.documentElement);

                    var failure = xmlDoc.documentElement;

                    if (failure.getAttribute('xmlns') === this.XMPP_SASL) {
                        self.isAuthed = false;

                        self.Fire('XmppAuthFailed');
                    }

                    break;
                case 'success':
                    console.log('success response', xmlDoc.documentElement);

                    var success = xmlDoc.documentElement;

                    if (success.getAttribute('xmlns') === self.XMPP_SASL) {
                        self.isAuthed = true;
                    }

                    if (self.isAuthed) {
                        self.SendWebSocketMessage(self.$openStream({ to: domain }));
                    }

                    break;
                case 'iq':
                    console.log('iq response', xmlDoc.documentElement);

                    var iq = xmlDoc.documentElement;

                    if (iq.getAttribute('type') === 'result') {
                        var bind = self.GetFirstElement(iq.getElementsByTagName('bind'));

                        if (bind && bind.getAttribute('xmlns') === self.XMPP_BIND) {
                            var jidValue = self.GetFirstElementValue(iq.getElementsByTagName('jid'));

                            if (jidValue) {
                                var jid: JID = new JID(jidValue);

                                if (jid.HasUser()) {
                                    self.currentJid = jid;

                                    self.isBound = true;

                                    boundCallback();
                                }
                            }
                        }
                    }

                    break;
                case 'presence':
                    console.log('presence response', xmlDoc.documentElement);

                    if (!self.isAuthed || !self.isBound) return;

                    // check if it has finished receiving the room roster

                    var presence = xmlDoc.documentElement;

                    var from = presence.getAttribute('from');

                    if (!from || !from.length) {
                        return;
                    }

                    var x = self.GetFirstElement(presence.getElementsByTagName('x'));

                    if (!x || x.getAttribute('xmlns') !== 'http://jabber.org/protocol/muc#user') {
                        return;
                    }

                    var statuses = x.getElementsByTagName('status');

                    if (!statuses || !statuses.length) {
                        return;
                    }

                    var hasSelfPresence = false;

                    for (var i = 0, length = statuses.length; i < length; i++) {
                        var status = statuses[i];

                        var code = status.getAttribute('code');

                        if (parseInt(code, 10) === XmppRoomStatus.SELF) {
                            var jid: JID = new JID(from);

                            jid.EnsureHasUser();

                            jid.EnsureHasDomain();

                            self.roomSelfPresences.push(jid.user + '@' + jid.domain);

                            hasSelfPresence = true;

                            break;
                        }
                    }

                    if (hasSelfPresence) {
                        presenceCallback();

                        self.Fire('XmppPresenceCompleted');
                    }

                    break;
                case 'message':
                    console.log('message response', xmlDoc.documentElement);

                    if (!self.isAuthed || !self.isBound) return;

                    var message = xmlDoc.documentElement;

                    var messageType = XmppMessageType[message.getAttribute('type').toUpperCase()];

                    var from = message.getAttribute('from');

                    var body = self.GetFirstElementValue(message.getElementsByTagName('body'));

                    var nick = self.GetFirstElementValue(message.getElementsByTagName('nick'));

                    var cseflags = self.GetFirstElement(message.getElementsByTagName('cseflags'));

                    var isCse = cseflags && cseflags.getAttribute('cse') === 'cse';

                    self.Fire('OnChat', messageType, from, body, nick, isCse);

                    break;
                default:
                    console.log('unhandled response', xmlDoc.documentElement.nodeName, xmlDoc.documentElement);
                    break;
            }
        };

        this.webSocket.onerror = e => {
            console.log('onerror', e);
        };

        this.webSocket.onclose = e => {
            console.log('onclose', e);

            self.webSocket = null;
            self.idCounter = 0;
            self.isAuthed = false;
            self.isBound = false;
            self.currentJid = null;
            self.roomSelfPresences = [];

            self.Fire('XmppDisconnected');
        };

        return this.webSocket;
    }

    private SendWebSocketChatMessage(messageType, room, input) {
        if (this.HasChatCurrentUser()) {
            if (this.HasRoomPresence(room)) {
                this.SendWebSocketMessageFromCurrentUser(messageType, room, input);
            } else {
                this.JoinRoomAsCurrentUser(room);
            }
        }
    }

    private HasWebSocket(): boolean {
        return this.webSocket !== null;
    }

    private HasOpenWebSocket(): boolean {
        return this.HasWebSocket() && this.webSocket.readyState == this.webSocket.OPEN;
    }

    private HasChatCurrentUser(): boolean {
        return this.HasOpenWebSocket() && this.isAuthed && this.isBound && this.currentJid && this.currentJid.HasUser();
    }

    private SendWebSocketMessage(msg: any): void {
        if (this.HasOpenWebSocket()) this.webSocket.send(msg.toString());
    }

    private HasRoomPresence(room): boolean {
        return this.roomSelfPresences.indexOf(room) !== -1;
    }

    private GetNextId(): string {
        return (++this.idCounter).toString(16);
    }

    private SendWebSocketMessageFromCurrentUser(messageType, room, input): void {
        this.SendWebSocketMessage($msg({ to: room, from: room + '/' + this.currentJid.user, type: XmppMessageType[messageType].toLowerCase(), id: this.GetNextId() }).c('body').t(input));
    }

    public JoinRoomAsCurrentUser(room: string) {
        this.SendWebSocketMessage($pres({ to: room + '/' + this.currentJid.user }).c('x', { xmlns: 'http://jabber.org/protocol/muc' }));
    }

    private GetFirstElement(elements) {
        if (elements && elements.length !== 0) {
            return elements[0];
        }
    }

    private GetFirstElementValue(elements) {
        var first = this.GetFirstElement(elements);
        if (first) {
            return this.GetElementNodeValue(first);
        }
    }

    private GetElementNodeValue(element) {
        if (element.childNodes && element.childNodes.length !== 0) {
            return element.childNodes[0].nodeValue;
        }
    }

    private ParseXml(xml) {
        if (typeof DOMParser !== 'undefined') {
            var domParser = new DOMParser();
            return domParser.parseFromString(xml, 'text/xml');
        } else if (typeof ActiveXObject !== 'undefined' && new ActiveXObject('Microsoft.XMLDOM')) {
            var xmlDoc = new ActiveXObject('Microsoft.XMLDOM');
            xmlDoc.async = 'false';
            xmlDoc.loadXML(xml);
            return xmlDoc;
        } else {
            throw new Error('No XML parser found');
        }
    }

    private $openStream(attrs) {
        if (!_.isObject(attrs)) {
            attrs = {};
        }

        if (!_.isString(attrs.xmlns)) {
            attrs.xmlns = 'jabber:client';
        }

        if (!_.isString(attrs['xmlns:stream'])) {
            attrs['xmlns:stream'] = 'http://etherx.jabber.org/streams';
        }

        if (!_.isString(attrs.version)) {
            attrs.version = '1.0';
        }

        return {
            toString: () => {
                var data = [];

                for (var key in attrs) {
                    if (attrs.hasOwnProperty(key)) {
                        data.push(' ', key, '=\'', attrs[key], '\'');
                    }
                }

                return (attrs.hasOpenXmlTag ? '<?xml version=\'1.0\'?>' : '') + '<stream:stream' + data.join('') + '>';
            }
        };
    }

    private $closeStream() {
        return {
            toString: () => '</stream:stream>'
        };
    }

    private $auth(attrs) {
        if (!_.isObject(attrs))
            attrs = {};

        if (!_.isString(attrs.mechanism)) {
            attrs.mechanism = XmppAuthMechanism[XmppAuthMechanism.PLAIN];
        } else if (_.isNumber(attrs.mechanism)) {
            attrs.mechanism = XmppAuthMechanism[attrs.mechanism];
        }

        if (!_.isString(attrs.value)) {
            switch (XmppAuthMechanism[attrs.mechanism]) {
                case XmppAuthMechanism[XmppAuthMechanism.PLAIN]:
                    if (!_.isString(attrs.username) || !_.isString(attrs.password)) {
                        throw new Error('$auth with PLAIN mechanism requires username and password');
                    }
                    break;
                case XmppAuthMechanism[XmppAuthMechanism.CSELOGINTOKEN]:
                    if (!_.isString(attrs.loginToken)) {
                        throw new Error('$auth with CSELOGINTOKEN mechanism requires login token');
                    }
                    break;
            }
        }

        if (!_.isString(attrs.xmlns)) {
            attrs.xmlns = 'urn:ietf:params:xml:ns:xmpp-sasl';
        }

        return {
            toString: () => {
                var data = [];

                for (var key in attrs) {
                    if (attrs.hasOwnProperty(key) && key != 'value' && key != 'loginToken' && key != 'username' && key != 'password') {
                        data.push(' ', key, '=\'', attrs[key], '\'');
                    }
                }

                var value: string;

                if (attrs.value) {
                    value = attrs.value;
                } else {
                    switch (attrs.mechanism) {
                        case XmppAuthMechanism[XmppAuthMechanism.PLAIN]:
                            value = Base64.encode('\0' + attrs.username + '\0' + attrs.password);
                            break;
                        case XmppAuthMechanism[XmppAuthMechanism.CSELOGINTOKEN]:
                            value = Base64.encode(attrs.loginToken);
                            break;
                    }
                }

                return '<auth' + data.join('') + '>' + value + '</auth>';
            }
        };
    }
}

class Tooltip {
    static $window: JQuery;

    static $container: JQuery;

    static showTimeout: number;

    static hideTimeout: number;

    constructor(private elements: any, private options: any = {}) {
        Tooltip.$window = Tooltip.$window || $(window);

        Tooltip.$container = Tooltip.$container || $('#tooltip');

        if (!Tooltip.$container.length) {
            Tooltip.$container = $('<div>').attr('id', 'tooltip').appendTo(document.body);
        }

        this.bindEvents();
    }

    public show(e: JQueryEventObject) {
        var $target = $(e.target);

        var title;

        if (_.isString(this.options.title)) {
            title = this.options.title;
        } else if (_.isFunction(this.options.title)) {
            title = this.options.title();
        } else {
            title = $target.attr('data-tooltip-title');
        }

        var hasTitle = !_.isEmpty(title);

        var content;

        if (_.isString(this.options.content) || _.isObject(this.options.content)) {
            content = this.options.content;
        } else if (_.isFunction(this.options.content)) {
            content = this.options.content();
        } else {
            content = $target.attr('data-tooltip-content');
        }

        var hasContent = !_.isEmpty(content);

        if (!hasTitle && !hasContent) return;

        clearTimeout(Tooltip.hideTimeout);

        Tooltip.hideTimeout = null;

        Tooltip.$container.empty();

        if (hasTitle) {
            $('<h1>').addClass('tooltip-title').text(title).appendTo(Tooltip.$container);
        }

        if (hasContent) {
            if (_.isString(content)) {
                $('<div>').addClass('tooltip-content').text(content).appendTo(Tooltip.$container);
            } else {
                $('<div>').addClass('tooltip-content').appendTo(Tooltip.$container).append(content);
            }
        }

        var offset = $target.offset();

        var left = offset.left + (this.options.leftOffset || 0);

        var windowWidth = Tooltip.$window.width() - 5;

        var containerWidth = Tooltip.$container.outerWidth();

        if (left + containerWidth > windowWidth) {
            left = windowWidth - containerWidth;
        }

        var top = offset.top - Tooltip.$container.height() + (this.options.topOffset || 0);

        Tooltip.$container.css({ left: left, top: top });

        var showDelay = _.isNumber(this.options.showDelay) ? this.options.showDelay : 800;

        Tooltip.showTimeout = setTimeout(() => Tooltip.$container.stop().fadeIn(200), showDelay);
    }

    public hide(e) {
        clearTimeout(Tooltip.showTimeout);

        Tooltip.showTimeout = null;

        var hideDelay = _.isNumber(this.options.hideDelay) ? this.options.hideDelay : 400;

        Tooltip.hideTimeout = setTimeout(() => Tooltip.$container.stop().fadeOut(100), hideDelay);
    }
    
    public move(left, top) {
        Tooltip.$container.css({ left: left, top: top });
    }

    public destroy() {
        if (this.elements) {
            this.elements.unbind('mouseenter mouseleave');
        }
    }

    public bindEvents() {
        if (this.elements) {
            if (_.isString(this.elements)) {
                $(this.elements).unbind('mouseenter mouseleave').hover(this.show.bind(this), this.hide.bind(this));
            } else if (_.isObject(this.elements)) {
                this.elements.unbind('mouseenter mouseleave').hover(this.show.bind(this), this.hide.bind(this));
            }
        }

        return this;
    }
}

var cu: CU = new CU();

interface CUInGameAPI {
    // These are the only things that are guaranteed to exist from the time
    // the page is created. Everything else will be constructed over the course
    // of the client's setup, concurrent to the page load and inital script
    // execution. Anything you need to do in setup should be attached to
    // cu.OnInitialized(), which will be called after the page is loaded
    // and this is fully set up.
    initialized: boolean;
    OnInitialized(c: () => void): number;
    CancelOnInitialized(c: number): void;

    // Everything else only exists after this.initialized is set and the
    // OnInitialized callbacks are invoked.

    /* Shared */

    patchResourceChannel: number;
    loginToken: string;
    pktHash: string;
    webAPIHost: string;
    serverURL: string;
    serverTime: number;
    vsync: number;

    OnServerConnected(c: (isConnected: boolean) => void): number;
    CancelOnServerConnected(c: number): void;
    OpenUI(name: string): void;
    CloseUI(name: string): void;
    HideUI(name: string): void;
    ShowUI(name: string): void;
    ToggleUIVisibility(name: string): void;
    RequestInputOwnership(): void;
    ReleaseInputOwnership(): void;
    Quit(): void;
    CrashTheGame(): void;
    OnUpdateNameplate(c: (cell: number, colorMod: number, name: string, gtag: string, title: string) => void): void;

    /* Respawn */
    Respawn(id): void;

    /* Abilities */

    OnAbilityNumbersChanged(callback: (abilityNumbers: string[]) => void): void;

    Attack(abilityID: string): void;

    OnAbilityCooldown(c: (cooldownID: number, timeStarted: number, duration: number) => void): number;
    CancelOnAbilityCooldown(c: number): void;

    OnAbilityActive(c: (currentAbility: string, timeStarted: number, timeTriggered: number, queuedAbility: string) => any): number;
    CancelOnAbilityActive(c: number): void;

    OnAbilityError(c: (message: string) => void): void;

    /* Items */

    GetItem(itemID: string): void;
    OnGetItem(callback: (itemID: string, data: string) => void): void;

    OnItemEquipped(callback: (itemID: string) => void): void;
    OnItemUnequipped(callback: (itemID: string) => void): void;

    /* Equipped Gear */

    OnEquippedGearItemIDsChanged(callback: (gearItemIDs: string[]) => void): void;

    UnequipItem(itemID: string): void;

    /* Inventory */

    OnInventoryItemIDsChanged(callback: (inventoryItemIDs: string[]) => void): void;

    EquipItem(itemID: string): void;

    /* Config */

    OnReceiveConfigVars(c: (configs: string) => void): void;
    OnReceiveConfigVar(c: (config: any) => void): void;
    OnConfigVarChanged(c: (isChangeSuccessful: boolean) => void): void;
    SaveConfigChanges(): void;
    OnSavedConfigChanges(c: () => void): void;
    RestoreConfigDefaults(tag: Tags): void;
    ChangeConfigVar(variable: string, value: string): void;
    CancelChangeConfig(variable: string): void;
    CancelAllConfigChanges(tag: Tags): void;
    GetConfigVars(tag: Tags): void;
    GetConfigVar(variable: string): void;

    /* Building */
    OnBuildingModeChanged(c: (buildingMode: boolean) => void): void;
    OnReceiveBlocks(c: (buildingDict: any) => void): void;
    ToggleBuildingMode(): void;
    SetBuildingMode(c: (newMode: number) => void): void;
    RequestBlocks(): void;
    ChangeBlockType(c: (newType: number) => void): void;
    CommitBlock(): void;
    CancelBlockPlacement(): void;
    BlockRotateX(): void;
    BlockRotateY(): void;
    BlockRotateZ(): void;
    BlockFlipX(): void;
    BlockFlipY(): void;
    BlockFlipZ(): void;

    /* Announcement */

    OnAnnouncement(c: (message: string, type: number) => void): void;

    /* Character */

    OnCharacterIDChanged(c: (id: string) => void): void;
    OnCharacterFactionChanged(c: (faction: number) => void): void;
    OnCharacterRaceChanged(c: (race: number) => void): void;
    OnCharacterNameChanged(c: (name: string) => void): void;
    OnCharacterHealthChanged(c: (health: number, maxHealth: number) => void): void;
    OnCharacterStaminaChanged(c: (stamina: number, maxStamina: number) => void): void;
    OnCharacterEffectsChanged(c: (effects: string) => void): void;

    /* EMOTE */

    Emote(emote: number): void;

    /* Enemy Target */

    OnEnemyTargetNameChanged(callback: (name: string) => void): void;
    OnEnemyTargetHealthChanged(callback: (health: number, maxHealth: number) => void): void;
    OnEnemyTargetStaminaChanged(callback: (stamina: number, maxStamina: number) => void): void;
    OnEnemyTargetEffectsChanged(callback: (effects: string) => void): void;

    /* Friendly Target */

    OnFriendlyTargetNameChanged(callback: (name: string) => void): void;
    OnFriendlyTargetHealthChanged(callback: (health: number, maxHealth: number) => void): void;
    OnFriendlyTargetStaminaChanged(callback: (stamina: number, maxStamina: number) => void): void;
    OnFriendlyTargetEffectsChanged(callback: (effects: string) => void): void;

    /* Chat */

    OnBeginChat(c: (commandMode: number, text: string) => void): void;
    OnChat(c: (type: number, from: string, body: string, nick: string, iscse: boolean) => void): void;
    SendChat(type: number, to: string, body: string): void;
    JoinMUC(room: string): void;
    LeaveMUC(room: string): void;
    Stuck(): void;
    ChangeZone(zoneID: number): void;

    /* Ability Crafting */

    ShowAbility(abilityID: string): void;
    OnShowAbility(callback: (abilityID: string) => void): void;

    EditAbility(abilityID: string): void;
    OnEditAbility(callback: (abilityID: string) => void): void;

    AbilityCreated(abilityID: string, primaryBaseComponentID: string, secondaryBaseComponentID: string, ability: string): void;
    OnAbilityCreated(callback: (abilityID: string, ability: string) => void): void;

    AbilityDeleted(abilityID: string): void;
    OnAbilityDeleted(callback: (abilityID: string) => void): void;

    RegisterAbility(abilityID: string, primaryBaseComponentID: string, secondaryBaseComponentID: string): void;
    OnAbilityRegistered(callback: (abilityID: string, cooldowns: string, duration: number, triggerTime: number) => void): void;

    /* Stats */

    fps: number;
    frameTime: number;
    netstats_udpPackets: number;
    netstats_udpBytes: number;
    netstats_tcpMessages: number;
    netstats_tcpBytes: number;
    netstats_players_updateBits: number;
    netstats_players_updateCount: number;
    netstats_players_newCount: number;
    netstats_players_newBits: number;
    netstats_lag: number;
    particlesRenderedCount: number;
    speed: number;
    locationX: number;
    locationY: number;
    locationZ: number;
    characters: number;
    terrain: number;
    perfHUD: string;

    /* Console */

    OnConsoleText(c: (text: string) => void): void;
    ConsoleCommand(body: string): void;

    /* Login */

    Connect(host: string, port: string, character: string, webAPIHost: string): void;
}

declare var cuAPI: CUInGameAPI;
