/********************************************************************************
 * Copyright (C) 2020 RedHat and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable, inject } from 'inversify';
import {
    FrontendApplicationContribution,
    FrontendApplication,
    ViewContainer,
    WidgetManager, Widget
} from '@theia/core/lib/browser';
import { FileNavigatorContribution } from '@theia/navigator/lib/browser/navigator-contribution';
import { EXPLORER_VIEW_CONTAINER_ID } from '@theia/navigator/lib/browser';
import { TimelineWidget } from './timeline-widget';
import { TimelineService } from './timeline-service';
import { CommandRegistry } from '@theia/core/lib/common';
import { TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';

@injectable()
export class TimelineContribution implements FrontendApplicationContribution {

    @inject(FileNavigatorContribution)
    protected readonly explorer: FileNavigatorContribution;
    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;
    @inject(TimelineService)
    protected readonly timelineService: TimelineService;
    @inject(CommandRegistry)
    protected readonly commandRegistry: CommandRegistry;
    @inject(TabBarToolbarRegistry)
    protected readonly tabBarToolbar: TabBarToolbarRegistry;

    async onDidInitializeLayout?(app: FrontendApplication): Promise<void> {
        const explorer = await this.widgetManager.getWidget(EXPLORER_VIEW_CONTAINER_ID);
        let timeline: TimelineWidget;
        this.timelineService.onDidChangeProviders( async event => {
            if (explorer instanceof ViewContainer) {
                if (event.added && event.added.length > 0 && explorer.getTrackableWidgets().indexOf(timeline) === -1) {
                    timeline = await this.widgetManager.getOrCreateWidget(TimelineWidget.ID);
                    explorer.addWidget(timeline, { initiallyCollapsed: true });
                } else if (event.removed && this.timelineService.getSources().length === 0) {
                    timeline.close();
                }
            }
        });
        const toolbarItem = {
            id: 'timeline-refresh-toolbar-item',
            command: 'timeline-refresh',
            tooltip: 'Refresh',
            icon: 'fa fa-refresh'
        };
        this.commandRegistry.registerCommand({ id: toolbarItem.command }, {
            execute: widget => this.checkWidget(widget, () => {
                if (timeline) {
                    timeline.refreshList();
                }
            }),
            isEnabled: widget => this.checkWidget(widget, () => true),
            isVisible: widget => this.checkWidget(widget, () => true)
        });
        this.tabBarToolbar.registerItem(toolbarItem);
    }

    private checkWidget<T>(widget: Widget, cb: () => T): T | false {
        if (widget instanceof TimelineWidget && widget.id === TimelineWidget.ID) {
            return cb();
        }
        return false;
    }
}
