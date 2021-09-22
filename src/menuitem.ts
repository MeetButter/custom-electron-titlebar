/*--------------------------------------------------------------------------------------------------------
 *  This file has been modified by @AlexTorresSk (http://github.com/AlexTorresSk)
 *  to work in custom-electron-titlebar.
 *
 *  The original copy of this file and its respective license are in https://github.com/Microsoft/vscode/
 *
 *  Copyright (c) 2018 Alex Torres
 *  Licensed under the MIT License. See License in the project root for license information.
 *-------------------------------------------------------------------------------------------------------*/

import {
    EventType,
    addDisposableListener,
    addClass,
    removeClass,
    removeNode,
    append,
    $,
    hasClass,
    EventHelper,
    EventLike
} from "vs/base/browser/dom";
import {BrowserWindow, Accelerator, NativeImage, MenuItem} from "electron";
import {MENU_MNEMONIC_REGEX, cleanMnemonic, MENU_ESCAPED_MNEMONIC_REGEX} from "./mnemonic";
import {KeyCode, KeyCodeUtils} from "vs/base/common/keyCodes";
import {Disposable} from "vs/base/common/lifecycle";
import {isMacintosh} from "vs/base/common/platform";
import {IMenuItem, IMenuStyle, IMenuOptions} from './api'
import * as strings from 'vs/base/common/strings';
import {EventType as TouchEventType} from 'vs/base/browser/touch';
const remote = require("@electron/remote");

let menuItemId = 0;

export class CETMenuItem extends Disposable implements IMenuItem {

    protected options: IMenuOptions;
    protected menuStyle: IMenuStyle | undefined;
    protected container: HTMLElement | undefined;
    protected itemElement: HTMLElement | undefined;

    private readonly item: MenuItem;
    private labelElement: HTMLElement | undefined;
    private checkElement: HTMLElement | undefined;
    private iconElement: HTMLElement | undefined;
    private readonly mnemonic: KeyCode | undefined;
    protected readonly closeSubMenu: () => void;

    private event: Electron.Event | undefined;
    private readonly currentWindow: BrowserWindow;

    constructor(item: MenuItem, options: IMenuOptions = {}, closeSubMenu = () => {
    }) {
        super();

        this.item = item;
        this.options = options;
        this.options.icon = options.icon !== undefined ? options.icon : false;
        this.options.label = options.label !== undefined ? options.label : true;

        this.currentWindow = remote.getCurrentWindow();
        this.closeSubMenu = closeSubMenu;

        // Set mnemonic
        if (this.options.label && options.enableMnemonics) {
            let label = this.item.label;
            if (label) {
                const matches = MENU_MNEMONIC_REGEX.exec(label);
                if (matches) {
                    this.mnemonic = KeyCodeUtils.fromString((!!matches[1] ? matches[1] : matches[3]).toLocaleUpperCase());
                }
            }
        }

        //this.item._id = menuItemId++;
    }

    getContainer() {
        return this.container;
    }

    isEnabled(): boolean {
        return this.item.enabled;
    }

    isSeparator(): boolean {
        return this.item.type === 'separator';
    }

    render(container: HTMLElement): void {
        if (!container) return;

        this.container = container;

        this._register(addDisposableListener(this.container!, TouchEventType.Tap, e => this.onClick(e)));

        this._register(addDisposableListener(this.container!, EventType.MOUSE_DOWN, e => {
            if (this.item.enabled && e.button === 0) {
                this.container!.classList.add('active');
            }
        }));

        this._register(addDisposableListener(this.container, EventType.CLICK, e => {
            if (this.item.enabled) {
                this.onClick(e);
            }
        }));

        this._register(addDisposableListener(this.container, EventType.DBLCLICK, e => {
            EventHelper.stop(e, true);
        }));

        [EventType.MOUSE_UP, EventType.MOUSE_OUT].forEach(event => {
            this._register(addDisposableListener(this.container!, event, e => {
                EventHelper.stop(e);
                this.container!.classList.remove('active');
            }));
        });

        this.itemElement = append(this.container, $('a.action-menu-item'));
        this.itemElement.setAttribute('role', 'menuitem');

        if (this.mnemonic) {
            this.itemElement.setAttribute('aria-keyshortcuts', `${this.mnemonic}`);
        }

        this.checkElement = append(this.itemElement, $('span.menu-item-check'));
        this.checkElement.setAttribute('role', 'none');

        this.iconElement = append(this.itemElement, $('span.menu-item-icon'));
        this.iconElement.setAttribute('role', 'none');

        this.labelElement = append(this.itemElement, $('span.action-label'));

        this.setAccelerator();
        this.updateLabel();
        this.updateIcon();
        this.updateTooltip();
        this.updateEnabled();
        this.updateChecked();
        this.updateVisibility();
    }

    onClick(event: EventLike) {
        EventHelper.stop(event, true);

        if (this.item.click) {
            this.item.click(this.item as MenuItem, this.currentWindow, this.event);
        }

        if (this.item.type === 'checkbox') {
            this.item.checked = !this.item.checked;
            this.updateChecked();
        }

        this.closeSubMenu();
    }

    focus(): void {
        if (this.container) {
            this.container.focus();
            addClass(this.container, 'focused');
        }

        this.applyStyle();
    }

    blur(): void {
        if (this.container) {
            this.container.blur();
            removeClass(this.container, 'focused');
        }

        this.applyStyle();
    }

    setAccelerator(): void {
        let accelerator = null;
        if (this.item.role) {
            switch (this.item.role.toLocaleLowerCase()) {
                case 'undo':
                    accelerator = 'CtrlOrCmd+Z';
                    break;
                case 'redo':
                    accelerator = 'CtrlOrCmd+Y';
                    break;
                case 'cut':
                    accelerator = 'CtrlOrCmd+X';
                    break;
                case 'copy':
                    accelerator = 'CtrlOrCmd+C';
                    break;
                case 'paste':
                    accelerator = 'CtrlOrCmd+V';
                    break;
                case 'selectall':
                    accelerator = 'CtrlOrCmd+A';
                    break;
                case 'minimize':
                    accelerator = 'CtrlOrCmd+M';
                    break;
                case 'close':
                    accelerator = 'CtrlOrCmd+W';
                    break;
                case 'reload':
                    accelerator = 'CtrlOrCmd+R';
                    break;
                case 'forcereload':
                    accelerator = 'CtrlOrCmd+Shift+R';
                    break;
                case 'toggledevtools':
                    accelerator = 'CtrlOrCmd+Shift+I';
                    break;
                case 'togglefullscreen':
                    accelerator = 'F11';
                    break;
                case 'resetzoom':
                    accelerator = 'CtrlOrCmd+0';
                    break;
                case 'zoomin':
                    accelerator = 'CtrlOrCmd+Shift+=';
                    break;
                case 'zoomout':
                    accelerator = 'CtrlOrCmd+-';
                    break;
            }
        }

        if (this.item.label && this.item.accelerator) {
            accelerator = this.item.accelerator;
        }

        if (this.itemElement && accelerator !== null) {
            append(this.itemElement, $('span.keybinding')).textContent = parseAccelerator(accelerator);
        }
    }

    updateLabel(): void {
        if (this.item.label) {
            let label = this.item.label;

            if (label) {
                const cleanLabel = cleanMnemonic(label);

                if (!this.options.enableMnemonics) {
                    label = cleanLabel;
                }

                if (this.labelElement) {
                    this.labelElement.setAttribute('aria-label', cleanLabel.replace(/&&/g, '&'));
                }

                const matches = MENU_MNEMONIC_REGEX.exec(label);

                if (matches) {
                    label = strings.escape(label);

                    // This is global, reset it
                    MENU_ESCAPED_MNEMONIC_REGEX.lastIndex = 0;
                    let escMatch = MENU_ESCAPED_MNEMONIC_REGEX.exec(label);

                    // We can't use negative lookbehind so if we match our negative and skip
                    while (escMatch && escMatch[1]) {
                        escMatch = MENU_ESCAPED_MNEMONIC_REGEX.exec(label);
                    }

                    const replaceDoubleEscapes = (str: string) => str.replace(/&amp;&amp;/g, '&amp;');

                    if (escMatch) {
                        label = `${label.substr(0, escMatch.index)}<u aria-hidden="true">${escMatch[3]}</u>${label.substr(escMatch.index + escMatch[0].length)}`;
                    } else {

                    }

                    label = label.replace(/&amp;&amp;/g, '&amp;');
                    if (this.itemElement) {
                        this.itemElement.setAttribute('aria-keyshortcuts', (!!matches[1] ? matches[1] : matches[3]).toLocaleLowerCase());
                    }
                } else {
                    label = label.replace(/&&/g, '&');
                }
            }

            if (this.labelElement) {
                this.labelElement.innerHTML = label.trim();
            }
        }
    }

    updateIcon(): void {
        let icon: string | NativeImage | null = null;

        if (this.item.icon) {
            icon = this.item.icon;
        }

        if (this.iconElement && icon) {
            const iconE = append(this.iconElement, $('img'));
            iconE.setAttribute('src', icon.toString());
        }
    }

    updateTooltip(): void {
        let title: string | null = null;

        if (this.item.sublabel) {
            title = this.item.sublabel;
        } else if (!this.item.label && this.item.label && this.item.icon) {
            title = this.item.label;

            if (this.item.accelerator) {
                title = parseAccelerator(this.item.accelerator);
            }
        }

        if (this.itemElement && title) {
            this.itemElement.title = title;
        }
    }

    updateEnabled(): void {
        if (!this.container) return;

        if (this.item.enabled && this.item.type !== 'separator') {
            removeClass(this.container, 'disabled');
            this.container.tabIndex = 0;
        } else {
            addClass(this.container, 'disabled');
        }
    }

    updateVisibility(): void {
        if (!this.item.visible && this.itemElement) {
            this.itemElement.remove();
        }
    }

    updateChecked(): void {
        if (!this.itemElement) return

        if (this.item.checked) {
            this.itemElement.classList.add('checked')
            this.itemElement.setAttribute('role', 'menuitemcheckbox');
            this.itemElement.setAttribute('aria-checked', 'true');
        } else {
            this.itemElement.classList.remove('checked')
            this.itemElement.setAttribute('role', 'menuitem');
            this.itemElement.setAttribute('aria-checked', 'false');
        }
    }

    dispose(): void {
        if (this.itemElement) {
            this.itemElement.remove();
            this.itemElement = undefined;
        }

        super.dispose();
    }

    getMnemonic(): KeyCode | undefined {
        return this.mnemonic;
    }

    protected applyStyle() {
        if (!this.menuStyle) {
            return;
        }

        const isSelected = this.container && this.container.classList.contains('focused');
        const fgColor = isSelected && this.menuStyle.selectionForegroundColor ? this.menuStyle.selectionForegroundColor : this.menuStyle.foregroundColor;
        const bgColor = isSelected && this.menuStyle.selectionBackgroundColor ? this.menuStyle.selectionBackgroundColor : this.menuStyle.backgroundColor;

        if (!this.checkElement || !this.itemElement) {
            return;
        }

        if (fgColor) {
            this.itemElement.style.color = fgColor.toString();
            this.checkElement.style.backgroundColor = fgColor.toString();
        } else {
            this.itemElement.style.removeProperty('color');
            this.checkElement.style.removeProperty('background-color');
        }

        if (bgColor) {
            this.itemElement.style.backgroundColor = bgColor.toString();
        } else {
            this.itemElement.style.removeProperty('background-color');
        }
    }

    style(style: IMenuStyle): void {
        this.menuStyle = style;
        this.applyStyle();
    }
}

function parseAccelerator(a: Accelerator): string {
    let accelerator;
    if (!isMacintosh) {
        accelerator = a.replace(/(Cmd)|(Command)/gi, '');
    } else {
        accelerator = a.replace(/(Ctrl)|(Control)/gi, '');
    }

    accelerator = accelerator.replace(/(Or)/gi, '');

    return accelerator;
}
