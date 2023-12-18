function renderFavorites(images, favorites) {
    const favs = document.getElementById('favsContainer');

    favorites.toArray().forEach(id => {
        const img = document.createElement('img');
        img.src = images[id].urlMedium;
        img.alt = `cat photo #${id}`;
        img.className = 'fav-img';

        const a = document.createElement('a');
        a.href = images[id].urlLarge;
        a.appendChild(img);

        const card = document.createElement('article');
        card.className = 'fav-card';
        const footer = document.createElement('footer');
        // TODO add "show on map" link
        footer.appendChild(makeRemoveButton(id, card, favorites));

        card.appendChild(a);
        card.appendChild(footer);
        favs.appendChild(card);
    });
}

function makeRemoveButton(imageId, container, favorites) {
    const button = document.createElement('button');
    button.innerText = `Remove photo #${imageId} from favorites`;

    button.onclick = () => {
        favorites.remove(imageId);
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
