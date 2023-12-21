// Copyright (C) 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

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

    has(imageId) {
        return this.favSet.has(imageId);
    }

    remove(imageId) {
        this.favSet.delete(imageId);
    }

    toggle(imageId) {
        if (this.favSet.has(imageId)) {
            this.favSet.delete(imageId);
        } else {
            this.favSet.add(imageId);
        }
    }

    iconForStatus(imageId) {
        return this.favSet.has(imageId) ? iconFavorite : iconNonFavorite;
    }

    toArray() {
        return [...this.favSet];
    }

    write() {
        localStorage.setItem(FavoriteStore.storageKey, JSON.stringify(this.toArray()));
    }
}

