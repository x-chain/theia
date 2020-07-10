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
import { Command, CommandRegistry, MenuModelRegistry, MenuPath } from '@theia/core/lib/common';
import { TreeWidget, TreeProps, NodeProps, TREE_NODE_SEGMENT_GROW_CLASS } from '@theia/core/lib/browser/tree';
import { ContextMenuRenderer } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { TimelineNode, TimelineTreeModel } from './timeline-tree-model';
import { TimelineAggregate, TimelineService } from './timeline-service';
import { TimelineContextKeyService } from './timeline-context-key-service';
import * as React from 'react';

export const TIMELINE_ITEM_CONTEXT_MENU: MenuPath = ['timeline-item-context-menu'];

@injectable()
export class TimelineTreeWidget extends TreeWidget {

    static ID = 'timeline-resource-widget';
    static PAGE_SIZE = 20;

    private readonly timelinesBySource = new Map<string, TimelineAggregate>();

    @inject(EditorManager) protected readonly editorManager: EditorManager;
    @inject(MenuModelRegistry) protected readonly menus: MenuModelRegistry;
    @inject(TimelineContextKeyService) protected readonly contextKeys: TimelineContextKeyService;

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(TimelineService) protected readonly timelineService: TimelineService,
        @inject(TimelineTreeModel) readonly model: TimelineTreeModel,
        @inject(ContextMenuRenderer) protected readonly contextMenuRenderer: ContextMenuRenderer,
        @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry
    ) {
        super(props, model, contextMenuRenderer);
        this.id = TimelineTreeWidget.ID;
        this.addClass('timeline-outer-container');
    }

    protected renderNode(node: TimelineNode, props: NodeProps): React.ReactNode {
        const attributes = this.createNodeAttributes(node, props);
        const content = <TimelineItemNode
            handle={this.timelinesBySource.get(node.source)?.items.find(i => i.id === node.id)?.handle}
            source={node.source}
            name={node.name}
            uri={node.uri}
            label={node.description}
            title={node.detail}
            command={node.command}
            commandArgs={node.commandArgs}
            commandRegistry={this.commandRegistry}
            contextValue={node.contextValue}
            contextKeys={this.contextKeys}
            contextMenuRenderer={this.contextMenuRenderer}/>;
        return React.createElement('div', attributes, content);
    }
}

export namespace TimelineItemNode {
    export interface Props {
        source: string;
        uri: string;
        handle?: string;
        name?: string;
        label?: string;
        title?: string;
        command?: Command;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        commandArgs: any[];
        commandRegistry: CommandRegistry;
        contextValue?: string;
        contextKeys: TimelineContextKeyService;
        contextMenuRenderer: ContextMenuRenderer;
    }
}

export class TimelineItemNode extends React.Component<TimelineItemNode.Props> {
    render(): JSX.Element | undefined {
        const { name, label, title } = this.props;
        return <div className='timelineItem'
                    title={title}
                    onContextMenu={this.renderContextMenu}
                    onClick={this.open}>
            <div className={`noWrapInfo ${TREE_NODE_SEGMENT_GROW_CLASS}`} >
                <span className='name'>{name}</span>
                <span className='label'>{label}</span>
            </div>
        </div>;
    }

    protected open = () => {
        const command: Command | undefined = this.props.command;
        if (command) {
            this.props.commandRegistry.executeCommand(command.id, ...this.props.commandArgs);
        }
    };

    protected renderContextMenu = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        const { source, uri, handle, contextValue, contextKeys, contextMenuRenderer } = this.props;
        const currentTimelineItem = contextKeys.timelineItem.get();
        contextKeys.timelineItem.set(contextValue);
        try {
            contextMenuRenderer.render({
                menuPath: TIMELINE_ITEM_CONTEXT_MENU,
                anchor: event.nativeEvent,
                args: [{ id: 11, source, uri, handle }, { id: 12, uri}, source]
            });
        } finally {
            contextKeys.timelineItem.set(currentTimelineItem);
        }
    };
}
