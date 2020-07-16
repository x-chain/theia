/********************************************************************************
 * Copyright (C) 2020 Red Hat, Inc. and others.
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

import { LabelServiceMain } from '../../common/plugin-api-rpc';
import { interfaces } from 'inversify';
import { Disposable } from '@theia/core/lib/common/disposable';
import { LabelProvider, ResourceLabelFormatter } from '@theia/core/lib/browser';

export class LabelServiceMainImpl implements LabelServiceMain {
    private readonly resourceLabelFormatters = new Map<number, Disposable>();
    private readonly labelProvider: LabelProvider;

    constructor(container: interfaces.Container) {
        this.labelProvider = container.get(LabelProvider);
    }

    $registerResourceLabelFormatter(handle: number, formatter: ResourceLabelFormatter): void {
        formatter.priority = true;
        this.resourceLabelFormatters.set(handle, this.labelProvider.registerFormatter(formatter));
    }

    $unregisterResourceLabelFormatter(handle: number): void {
        const toDispose = this.resourceLabelFormatters.get(handle);
        if (toDispose) {
            toDispose.dispose();
        }
        this.resourceLabelFormatters.delete(handle);
    }
}
