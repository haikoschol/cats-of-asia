// SPDX-FileCopyrightText: 2023 Haiko Schol
// SPDX-License-Identifier: GPL-3.0-or-later

function renderFavorites(favorites, images, container) {
    favorites.toArray().forEach(hash => {
        const img = document.createElement('img');
        img.src = images[hash].urls.smol;
        img.alt = `cat photo #${hash}`;
        img.className = 'fav-img';

        const a = document.createElement('a');
        a.href = images[hash].urls.desktop;
        a.appendChild(img);

        const card = document.createElement('article');
        card.className = 'fav-card';
        const footer = document.createElement('footer');
        // TODO add "show on map" link
        footer.appendChild(makeRemoveButton(hash, card, favorites));

        card.appendChild(a);
        card.appendChild(footer);
        container.appendChild(card);
    });
}

function makeRemoveButton(imageHash, container, favorites) {
    const button = document.createElement('button');
    button.innerText = `Remove from favorites`;

    button.onclick = () => {
        favorites.remove(imageHash);
        favorites.write();
        container.remove();
        updateVisibility(favorites);
    }
    return button;
}

function updateVisibility(favorites) {
    const noFavs = document.getElementById('noFavs');
    const favs = document.getElementById('favsContainer');

    if (favorites.size === 0) {
        favs.hidden = true;
        noFavs.hidden = false;
    } else {
        favs.hidden = false;
        noFavs.hidden = true;
    }
}
