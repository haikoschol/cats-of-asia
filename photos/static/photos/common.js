// SPDX-FileCopyrightText: 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

class FavoriteStore {
    static storageKey = 'favorites';

    favSet;

    constructor() {
        const favoritesItem = localStorage.getItem(FavoriteStore.storageKey);
        const favorites = JSON.parse(favoritesItem ? favoritesItem : '[]');
        this.favSet = new Set(favorites);
    }

    get size() {
        return this.favSet.size;
    }

    has(imageHash) {
        return this.favSet.has(imageHash);
    }

    remove(imageHash) {
        this.favSet.delete(imageHash);
    }

    toggle(imageHash) {
        if (this.favSet.has(imageHash)) {
            this.favSet.delete(imageHash);
        } else {
            this.favSet.add(imageHash);
        }
    }

    iconForStatus(imageHash) {
        return this.favSet.has(imageHash) ? iconFavorite : iconNonFavorite;
    }

    toArray() {
        return [...this.favSet];
    }

    write() {
        localStorage.setItem(FavoriteStore.storageKey, JSON.stringify(this.toArray()));
    }
}
