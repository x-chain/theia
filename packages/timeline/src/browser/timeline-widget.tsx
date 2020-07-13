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

/* eslint-disable no-null/no-null, @typescript-eslint/no-explicit-any */

import { Message } from '@phosphor/messaging';
import { inject, injectable, postConstruct } from 'inversify';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import {
    ApplicationShell,
    BaseWidget,
    MessageLoop,
    NavigatableWidget,
    Panel,
    PanelLayout,
    Widget
} from '@theia/core/lib/browser';
import { TimelineTreeWidget } from './timeline-tree-widget';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { TimelineService } from './timeline-service';
import { CommandRegistry } from '@theia/core/lib/common';
import { TimelineEmptyWidget } from './timeline-empty-widget';
import { toArray } from '@phosphor/algorithm';
import URI from '@theia/core/lib/common/uri';
import { EditorPreviewWidget } from '@theia/editor-preview/lib/browser';
import { TimelineProvidersChangeEvent } from '../common/timeline-model';
import { TimelineAggregate } from './timeline-service';

@injectable()
export class TimelineWidget extends BaseWidget {

    protected panel: Panel;
    static ID = 'timeline-view';

    private readonly timelinesBySource = new Map<string, TimelineAggregate>();

    @inject(TimelineTreeWidget) protected readonly resourceWidget: TimelineTreeWidget;
    @inject(TimelineService) protected readonly timelineService: TimelineService;
    @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry;
    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;
    @inject(TimelineEmptyWidget) protected readonly timelineEmptyWidget: TimelineEmptyWidget;

    constructor(@inject(EditorManager) protected readonly editorManager: EditorManager) {
        super();
        this.id = TimelineWidget.ID;
        this.addClass('theia-timeline');
    }

    @postConstruct()
    protected init(): void {
        const layout = new PanelLayout();
        this.layout = layout;
        this.panel = new Panel({
            layout: new PanelLayout({
            })
        });
        this.panel.node.tabIndex = -1;
        layout.addWidget(this.panel);
        this.containerLayout.addWidget(this.resourceWidget);
        this.containerLayout.addWidget(this.timelineEmptyWidget);

        this.refresh();
        this.refreshList();
        this.toDispose.push(this.timelineService.onDidChangeTimeline(event => {
                const current = this.editorManager.currentEditor;
                if (NavigatableWidget.is(current) && event.uri && event.uri.toString() === current.getResourceUri()?.toString()) {
                    this.loadTimeline(event.uri, event.reset);
                } else {
                    const uri = this.editorManager.currentEditor?.getResourceUri();
                    if (uri) {
                        this.loadTimeline(uri, event.reset);
                    }
                }
            })
        );
        this.toDispose.push(this.editorManager.onCurrentEditorChanged(async editor => {
            if (NavigatableWidget.is(editor)) {
                const uri = editor.getResourceUri();
                if (uri) {
                    this.timelineEmptyWidget.hide();
                    this.resourceWidget.show();
                    this.loadTimeline(uri, true);
                }
                return;
            }
            if (!toArray(this.applicationShell.mainPanel.widgets()).find(widget => {
                if (widget instanceof EditorWidget || widget instanceof EditorPreviewWidget) {
                    const uri = widget.getResourceUri();
                    if (uri?.scheme && this.timelineService.getSchemas().indexOf(uri?.scheme) > -1) {
                        return true;
                    }
                }
            })) {
                this.resourceWidget.hide();
                this.timelineEmptyWidget.show();
            }
        }));
        this.toDispose.push(this.timelineService.onDidChangeProviders(e => this.onProvidersChanged(e)));
    }

    private onProvidersChanged(event: TimelineProvidersChangeEvent): void {
        const currentUri = this.editorManager.currentEditor?.getResourceUri();
        if (event.removed) {
            for (const source of event.removed) {
                this.timelinesBySource.delete(source);
            }

            if (currentUri) {
                this.loadTimeline(currentUri, true);
            }
        } else if (event.added) {
            if (currentUri) {
                event.added.forEach( source => this.loadTimelineForSource(source, currentUri, true));
            }
        }
    }

    async loadTimelineForSource(source: string, uri: URI, reset: boolean): Promise<void> {
        if (reset) {
            this.timelinesBySource.delete(source);
        }
        let timeline = this.timelinesBySource.get(source);
        const cursor = timeline?.cursor;
        const options = { cursor: reset ? undefined : cursor, limit: TimelineTreeWidget.PAGE_SIZE };
        const timelineResult = await this.timelineService.getTimeline(source, uri, options);
        if (timelineResult) {
            const items = timelineResult.items;
            if (items) {
                if (timeline) {
                    timeline.add(items);
                    timeline.cursor = timelineResult.paging?.cursor;
                } else {
                    timeline = new TimelineAggregate(timelineResult);
                }
                this.timelinesBySource.set(source, timeline);
                this.resourceWidget.model.updateTree(timeline.items, !!timeline.cursor);
            }
        }
    }

    async loadTimeline(uri: URI, reset: boolean): Promise<void> {
        for (const source of this.timelineService.getSources().map(s => s.id)) {
            this.loadTimelineForSource(source, uri, reset);
        }
    }

    refreshList(): void {
        const current = this.editorManager.currentEditor;
        const uri = NavigatableWidget.is(current) ? current.getResourceUri() : undefined;
        if (uri) {
            this.timelineEmptyWidget.hide();
            this.resourceWidget.show();
            this.loadTimeline(uri, true);
        } else {
            this.timelineEmptyWidget.show();
            this.resourceWidget.hide();
        }
    }

    protected get containerLayout(): PanelLayout {
        return this.panel.layout as PanelLayout;
    }

    protected readonly toDisposeOnRefresh = new DisposableCollection();

    protected refresh(): void {
        this.toDisposeOnRefresh.dispose();
        this.toDispose.push(this.toDisposeOnRefresh);
        this.title.label = 'Timeline';
        this.title.caption = this.title.label;
        this.update();
    }

    protected updateImmediately(): void {
        this.onUpdateRequest(Widget.Msg.UpdateRequest);
    }

    protected onUpdateRequest(msg: Message): void {
        MessageLoop.sendMessage(this.resourceWidget, msg);
        MessageLoop.sendMessage(this.timelineEmptyWidget, msg);
        this.refreshList();
        super.onUpdateRequest(msg);
    }

    protected onAfterAttach(msg: Message): void {
        this.node.appendChild(this.resourceWidget.node);
        this.node.appendChild(this.timelineEmptyWidget.node);
        super.onAfterAttach(msg);
        this.update();
    }

}
