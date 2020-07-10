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

import { injectable } from 'inversify';
import {
    CompositeTreeNode,
    SelectableTreeNode,
    TreeModelImpl,
} from '@theia/core/lib/browser/tree';
import { Command } from '@theia/core/lib/common';
import { Timeline, TimelineItem } from '../common/timeline-protocol';
import { TimelineContribution } from './timeline-contribution';

export interface TimelineNode extends SelectableTreeNode {
    source: string;
    uri: string;
    description: string | undefined;
    detail: string | undefined;
    command: Command | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    commandArgs: any[];
    contextValue: string | undefined;
}

export class TimelineAggregate {
    readonly items: TimelineItem[];
    readonly source: string;
    readonly uri: string;

    private _cursor?: string;
    get cursor(): string | undefined {
        return this._cursor;
    }

    set cursor(cursor: string | undefined) {
        this._cursor = cursor;
    }

    constructor(timeline: Timeline) {
        this.source = timeline.source;
        this.items = timeline.items;
        this._cursor = timeline.paging?.cursor;
    }

    add(items: TimelineItem[]): void {
        this.items.push(...items);
        this.items.sort((a, b) => b.timestamp - a.timestamp);
    }
}

@injectable()
export class TimelineTreeModel extends TreeModelImpl {

    updateTree(source: string, uri: string, items: TimelineItem[], loadMore: boolean): void {
        const root = {
            id: 'timeline-tree-root',
            parent: undefined,
            visible: false,
            children: []
        } as CompositeTreeNode;
        const children = items.map(item => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const command: any = item.command;
            return {
                source,
                uri,
                id: item.id ? item.id : item.timestamp.toString(),
                parent: root,
                name: item.label,
                command: command,
                commandArgs: command.arguments,
                description: item.description,
                detail: item.detail,
                contextValue: item.contextValue,
                selected: false,
                visible: true
            } as TimelineNode;
        });
        if (loadMore) {
            children.push({
                source: source,
                uri,
                id: 'load-more',
                parent: root,
                name: 'Load-more',
                description: '',
                detail: undefined,
                command: TimelineContribution.LOAD_MORE_COMMAND,
                commandArgs: [],
                contextValue: undefined,
                selected: true
            });
        }
        root.children = children;
        this.root = root;
    }
}
