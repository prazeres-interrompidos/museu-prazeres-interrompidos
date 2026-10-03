// Overlay functionality
// callbacks
function CB_artwork_picked(index) {
	return function() {
		manual_navigation_idx = index;
		manual_move();
	};
}


//rest of utility functions

// Compute the camera pose for artwork `idx` in the current gallery.
// Returns { position, target, title, idx, count } or null when unavailable.
// Single source of truth shared by manual_move() and the cinematic tour, so the
// two navigation paths can never drift apart. Keeps the Z/Y axis swap ([0],[2],[1]).
function getArtworkPose(idx){
	if (typeof scene === 'undefined' || !scene) return null;
	if (typeof config_file_content === 'undefined' || !config_file_content) return null;

	var gallery=config_file_content[current_gallery];
	if (!gallery) return null;
	var dict_items=Object.keys(gallery).filter(key => gallery[key]["resource_type"]== "image");
	if (dict_items.length ==0) return null;
	var n_items=dict_items.length;

	//wrap index into range
	if (idx<0){
		idx= n_items-1;
	} else if (idx>=n_items){
		idx=0;
	}

	//get position and vector. Assuming they are JSON strings of 3-element arrays [x, y, z]
	let item_position_array = JSON.parse(gallery[dict_items[idx]]['location']);
	let item_vector_array = JSON.parse(gallery[dict_items[idx]]['vector']);

	// Create Babylon.js Vector3 objects
	const target_position = new BABYLON.Vector3(item_position_array[0], item_position_array[2], item_position_array[1]);
	const target_vector = new BABYLON.Vector3(item_vector_array[0], item_vector_array[2], item_vector_array[1]).normalize();

	// Calculate the camera's position to be in front of the item (closer on desktop)
	const camera_distance = window.innerWidth>600 ? 4 : 6;
	const camera_position = target_position.add(target_vector.scale(camera_distance));

	return {
		position: camera_position,
		target: target_position,
		title: "Title:  " + gallery[dict_items[idx]]["metadata"],
		idx: idx,
		count: n_items
	};
}

function manual_move(){
	const pose = getArtworkPose(manual_navigation_idx);
	if (!pose) return;

	manual_navigation_idx = pose.idx;

	//get active camera and snap into place
	const camera = scene.activeCamera;
	camera.position = pose.position;
	camera.setTarget(pose.target);

	showInfoBox(pose.title);

	// Na navegação manual, cada obra passa automaticamente para o seu episódio.
	playEpisodeForCurrentArtwork();
}

function manual_move_backward(){
	manual_navigation_idx--;
	manual_move();
}

function manual_move_forward(){
	manual_navigation_idx++;
	manual_move();
}



// ==========================================================================
//  Episódios do podcast: ligação automática E### -> MP3
// ===========================================================================

const EPISODES_GITHUB_REPO =
	'https://api.github.com/repos/prazeres-interrompidos/museu-prazeres-interrompidos';
const EPISODES_FOLDER = 'EPISÓDIOS PARA O MUSEU';

let episodeIndex = null;
let episodeIndexPromise = null;
let episodeCurrentCode = null;
let episodeCurrentUrl = null;
let episodeRequestSerial = 0;

function normalizeEpisodeCode(code){
	if (!code) return null;
	const m = String(code).match(/^E(\d+)$/i);
	if (!m) return null;
	return 'E' + String(parseInt(m[1], 10));
}

function decodeSafe(value){
	try { return decodeURIComponent(value); } catch (_) { return value; }
}

// O código é retirado do nome da imagem, nunca do título da obra.
// Assim E01.jpg -> E01, E544.jpg -> E544, independentemente do restante nome.
function extractEpisodeCodeFromResource(resource){
	if (!resource) return null;
	let value = decodeSafe(String(resource).split(/[?#]/)[0].replace(/\\/g, '/'));
	const fileName = value.substring(value.lastIndexOf('/') + 1);
	const m = fileName.match(/^(E\d+)(?!\d)/i);
	return normalizeEpisodeCode(m ? m[1] : null);
}

function getCurrentArtworkEntry(){
	if (typeof config_file_content === 'undefined' || !config_file_content) return null;
	if (typeof current_gallery === 'undefined') return null;
	const gallery = config_file_content[current_gallery];
	if (!gallery) return null;
	const dict_items = Object.keys(gallery).filter(
		key => gallery[key]["resource_type"] == "image"
	);
	if (!dict_items.length) return null;
	let idx = (typeof manual_navigation_idx === 'number') ? manual_navigation_idx : 0;
	if (idx < 0) idx = dict_items.length - 1;
	if (idx >= dict_items.length) idx = 0;
	return gallery[dict_items[idx]];
}

function getCurrentEpisodeCode(){
	const artwork = getCurrentArtworkEntry();
	if (!artwork) return null;
	return extractEpisodeCodeFromResource(artwork["resource"]);
}

function rawEpisodeUrl(branch, filePath){
	return 'https://raw.githubusercontent.com/prazeres-interrompidos/museu-prazeres-interrompidos/' +
		encodeURIComponent(branch) + '/' +
		filePath.split('/').map(part => encodeURIComponent(part)).join('/');
}

// Cria o índice através da árvore Git completa.
// Isto evita a limitação de paginação da API Contents (máximo de 100 itens por página)
// e garante que E544, e futuramente E1000+, também são encontrados.
function loadEpisodeIndex(){
	if (episodeIndex) return Promise.resolve(episodeIndex);
	if (episodeIndexPromise) return episodeIndexPromise;

	function fetchContentsAllPages(branch){
		const base = EPISODES_GITHUB_REPO + '/contents/' +
			EPISODES_FOLDER.split('/').map(part => encodeURIComponent(part)).join('/');
		const map = {};

		function fetchPage(page){
			const url = base + '?ref=' + encodeURIComponent(branch) + '&per_page=100&page=' + page;
			return fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } })
				.then(response => {
					if (!response.ok) throw new Error('GitHub Contents HTTP ' + response.status);
					return response.json();
				})
				.then(entries => {
					if (!Array.isArray(entries)) throw new Error('Resposta inválida do GitHub');
					entries.forEach(entry => {
						if (!entry || entry.type !== 'file') return;
						const fileName = String(entry.name || '');
						if (!/\.mp3$/i.test(fileName)) return;
						const m = fileName.match(/^(E\d+)(?!\d)/i);
						if (!m) return;
						const code = normalizeEpisodeCode(m[1]);
						if (!code) return;
						const filePath = entry.path || (EPISODES_FOLDER + '/' + fileName);
						if (!map[code]) map[code] = entry.download_url || rawEpisodeUrl(branch, filePath);
					});

					// GitHub Contents accepts a maximum of 100 per page. Continue until
					// the final page, so E544 and future E1000+ are never missed.
					if (entries.length === 100) return fetchPage(page + 1);
					return map;
				});
		}

		return fetchPage(1).then(result => {
			if (!Object.keys(result).length) throw new Error('Nenhum MP3 E### encontrado');
			return result;
		});
	}

	episodeIndexPromise = fetchContentsAllPages('main')
		.catch(() => fetchContentsAllPages('master'))
		.then(map => {
			episodeIndex = map;
			return map;
		})
		.catch(error => {
			console.warn('Não foi possível carregar o índice dos episódios:', error);
			episodeIndexPromise = null;
			throw error;
		});

	return episodeIndexPromise;
}

function updateEpisodeButton(state){
	const btn = document.getElementById('episodeToggle');
	if (!btn) return;

	if (state === 'playing'){
		btn.textContent = '⏸';
		btn.title = 'Pausar episódio';
		btn.setAttribute('aria-label', 'Pausar episódio');
		btn.disabled = false;
	} else if (state === 'loading'){
		btn.textContent = '▶';
		btn.title = 'A preparar episódio';
		btn.setAttribute('aria-label', 'A preparar episódio');
		btn.disabled = true;
	} else if (state === 'unavailable'){
		btn.textContent = '▶';
		btn.title = 'Episódio não encontrado';
		btn.setAttribute('aria-label', 'Episódio não encontrado');
		btn.disabled = true;
	} else {
		btn.textContent = '▶';
		btn.title = 'Ouvir episódio';
		btn.setAttribute('aria-label', 'Ouvir episódio');
		btn.disabled = false;
	}
}

function stopEpisodeAudio(){
	const audio = document.getElementById('episodeAudio');
	if (!audio) return;
	audio.pause();
	audio.currentTime = 0;
	episodeCurrentCode = null;
	episodeCurrentUrl = null;
	updateEpisodeButton('stopped');
}

function pauseMuseumMusicForEpisode(){
	const music = document.getElementById('museumMusic');
	if (!music) return;
	music.pause();
}

// Prepara o episódio da obra actual, mas não chama play().
// O play é feito pelo clique do botão, garantindo que o navegador o reconhece
// como uma acção do visitante.
function prepareEpisodeForCurrentArtwork(){
	const code = getCurrentEpisodeCode();
	const requestId = ++episodeRequestSerial;
	const audio = document.getElementById('episodeAudio');
	if (!audio) return Promise.reject(new Error('episodeAudio inexistente'));

	audio.pause();
	audio.currentTime = 0;
	episodeCurrentCode = null;
	episodeCurrentUrl = null;

	if (!code){
		updateEpisodeButton('unavailable');
		return Promise.reject(new Error('Código E### não encontrado na imagem'));
	}

	pauseMuseumMusicForEpisode();
	updateEpisodeButton('loading');

	return loadEpisodeIndex().then(map => {
		if (requestId !== episodeRequestSerial) throw new Error('pedido ultrapassado');
		const url = map[code];
		if (!url) throw new Error('Áudio não encontrado para ' + code);

		episodeCurrentCode = code;
		episodeCurrentUrl = url;
		if (audio.src !== url) audio.src = url;
		audio.load();
		updateEpisodeButton('stopped');
		return { code, url };
	}).catch(error => {
		if (requestId === episodeRequestSerial) updateEpisodeButton('unavailable');
		throw error;
	});
}

function playEpisodeForCurrentArtwork(){
	return prepareEpisodeForCurrentArtwork();
}

function toggleEpisodeAudio(){
	const audio = document.getElementById('episodeAudio');
	if (!audio) return;

	if (!audio.paused){
		audio.pause();
		return;
	}

	pauseMuseumMusicForEpisode();

	// O índice é pré-carregado. Quando o botão é premido, a URL já deve estar
	// disponível e play() acontece directamente dentro do gesto do utilizador.
	if (episodeCurrentUrl){
		const p = audio.play();
		if (p && p.catch) p.catch(() => updateEpisodeButton('stopped'));
		return;
	}

	// Se ainda estiver a preparar, não iniciamos play() dentro do .then().
	// O próximo clique, já com a URL preparada, iniciará o áudio.
	prepareEpisodeForCurrentArtwork().catch(() => {});
}

function initEpisodeAudio(){
	const audio = document.getElementById('episodeAudio');
	if (!audio) return;

	audio.onplay = function(){
		pauseMuseumMusicForEpisode();
		updateEpisodeButton('playing');
	};
	audio.onpause = function(){
		if (!audio.ended) updateEpisodeButton('stopped');
	};
	audio.onended = function(){
		updateEpisodeButton('stopped');
	};
	updateEpisodeButton('stopped');

	// Pré-carrega o índice dos 545+ episódios em segundo plano.
	loadEpisodeIndex().catch(() => {});
}

// ==========================================================================
//  Cinematic visit: self-running, eased camera tour of the current gallery
// ==========================================================================

const CINEMATIC_DWELL_MS = 4000;   // pause at each artwork
const CINEMATIC_FPS = 60;

let cinematic_active = false;
let cinematic_queue = [];          // shuffled artwork indices, drained per leg
let cinematic_last_idx = -1;       // to avoid an immediate repeat on reshuffle
let cinematic_timer = null;        // dwell setTimeout handle
let cinematic_anims = [];          // running Animatable refs (position + rotation)
let cinematic_saved_collisions = null;
let cinematic_saved_gravity = null;

function cinematicCanvas(){
	return document.getElementById('renderCanvas');
}

// Number of images in the current gallery (0 when no scene/gallery yet).
function cinematicArtworkCount(){
	if (typeof config_file_content === 'undefined' || !config_file_content) return 0;
	if (typeof current_gallery === 'undefined') return 0;
	var gallery = config_file_content[current_gallery];
	if (!gallery) return 0;
	return Object.keys(gallery).filter(key => gallery[key]["resource_type"] == "image").length;
}

// Pick the next artwork index, reshuffling (Fisher-Yates) when the queue empties
// and avoiding an immediate repeat of the last visited artwork.
function nextCinematicIndex(){
	const n = cinematicArtworkCount();
	if (n === 0) return -1;
	if (n === 1) return 0;

	if (cinematic_queue.length === 0){
		cinematic_queue = Array.from({length: n}, (_, i) => i);
		for (let i = cinematic_queue.length - 1; i > 0; i--){
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = cinematic_queue[i];
			cinematic_queue[i] = cinematic_queue[j];
			cinematic_queue[j] = tmp;
		}
		// don't start the fresh queue on the artwork we just left
		if (cinematic_queue[0] === cinematic_last_idx){
			cinematic_queue.push(cinematic_queue.shift());
		}
	}
	return cinematic_queue.shift();
}

// Fly to one artwork, then schedule the next leg after the dwell.
function cinematicLeg(){
	if (!cinematic_active) return;

	const idx = nextCinematicIndex();
	if (idx < 0){ stopCinematicVisit(); return; }
	const pose = getArtworkPose(idx);
	if (!pose){ stopCinematicVisit(); return; }

	const camera = scene.activeCamera;

	// Duration scaled by distance so short hops don't whip, long hops don't crawl.
	const dist = BABYLON.Vector3.Distance(camera.position, pose.position);
	const seconds = Math.min(5, Math.max(2, dist / 3));
	const frames = Math.round(seconds * CINEMATIC_FPS);

	const ease = new BABYLON.CubicEase();
	ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

	// Destination rotation via save/restore: setTarget writes camera.rotation from
	// the camera's CURRENT position, so we must momentarily place the camera at the
	// destination before reading the look-at rotation — otherwise the camera aims at
	// the artwork from where it started, landing slightly (then increasingly) off to
	// the side. Restore both position and rotation before animating.
	const startRot = camera.rotation.clone();
	const startPos = camera.position.clone();
	camera.position.copyFrom(pose.position);
	camera.setTarget(pose.target);
	const endRot = camera.rotation.clone();
	camera.position.copyFrom(startPos);
	camera.rotation.copyFrom(startRot);

	// Turn the short way: normalize the yaw delta into (-PI, PI].
	const twoPi = Math.PI * 2;
	let yawDelta = endRot.y - startRot.y;
	yawDelta = ((yawDelta + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
	const targetRot = new BABYLON.Vector3(endRot.x, startRot.y + yawDelta, endRot.z);

	cinematic_anims = [];
	const posAnim = BABYLON.Animation.CreateAndStartAnimation(
		'cinematic_pos', camera, 'position', CINEMATIC_FPS, frames,
		camera.position.clone(), pose.position,
		BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, ease,
		function(){
			// onAnimationEnd — also fires on .stop(), so guard on active state
			if (!cinematic_active) return;
			showInfoBox(pose.title);
			manual_navigation_idx = idx;   // ◀/▶ continue from here after the tour
			cinematic_last_idx = idx;
			if (cinematicArtworkCount() <= 1){
				// single artwork: arrive, dwell, then hand control back (no loop)
				cinematic_timer = setTimeout(stopCinematicVisit, CINEMATIC_DWELL_MS);
			} else {
				cinematic_timer = setTimeout(cinematicLeg, CINEMATIC_DWELL_MS);
			}
		}
	);
	const rotAnim = BABYLON.Animation.CreateAndStartAnimation(
		'cinematic_rot', camera, 'rotation', CINEMATIC_FPS, frames,
		startRot, targetRot,
		BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, ease
	);
	cinematic_anims.push(posAnim, rotAnim);
}

// Cancel signals: grabbing the controls (movement key or canvas tap/click) stops the tour.
function cinematicCancelKey(e){
	const movementKeys = [37, 38, 39, 40, 87, 65, 83, 68]; // arrows + WASD
	if (movementKeys.indexOf(e.keyCode) !== -1) stopCinematicVisit();
}
function cinematicCancelPointer(){
	stopCinematicVisit();
}

function setCinematicButtonState(active){
	const btn = document.querySelector('.cinematic-button');
	if (!btn) return;
	// Icon-only button: toggle the active glow and update the tooltip/label, but
	// never touch textContent (that would wipe the inline SVG).
	btn.classList.toggle('active', active);
	btn.title = active ? 'Parar visita cinematográfica' : 'Visita cinematográfica';
	btn.setAttribute('aria-label', btn.title);
}

function startCinematicVisit(){
	if (cinematic_active) return;
	if (typeof scene === 'undefined' || !scene || !scene.activeCamera) return;
	if (cinematicArtworkCount() === 0) return;

	cinematic_active = true;
	cinematic_queue = [];

	const camera = scene.activeCamera;

	// Disable physics during flight: walls/furniture would block the path and
	// gravity fights the vertical easing. Restored on stop.
	cinematic_saved_collisions = camera.checkCollisions;
	cinematic_saved_gravity = camera.applyGravity;
	camera.checkCollisions = false;
	camera.applyGravity = false;

	// Input is the cancel signal, not detachControl().
	window.addEventListener('keydown', cinematicCancelKey);
	const cv = cinematicCanvas();
	if (cv) cv.addEventListener('pointerdown', cinematicCancelPointer);

	setCinematicButtonState(true);
	cinematicLeg();
}

function stopCinematicVisit(){
	if (!cinematic_active) return;
	cinematic_active = false;

	if (cinematic_timer){ clearTimeout(cinematic_timer); cinematic_timer = null; }
	cinematic_anims.forEach(a => { if (a && typeof a.stop === 'function') a.stop(); });
	cinematic_anims = [];

	if (typeof scene !== 'undefined' && scene && scene.activeCamera){
		const camera = scene.activeCamera;
		if (cinematic_saved_collisions !== null) camera.checkCollisions = cinematic_saved_collisions;
		if (cinematic_saved_gravity !== null) camera.applyGravity = cinematic_saved_gravity;
	}
	cinematic_saved_collisions = null;
	cinematic_saved_gravity = null;

	window.removeEventListener('keydown', cinematicCancelKey);
	const cv = cinematicCanvas();
	if (cv) cv.removeEventListener('pointerdown', cinematicCancelPointer);

	setCinematicButtonState(false);
}

// Toggle handler wired from the overlay button.
function CB_cinematic_visit(){
	if (cinematic_active) stopCinematicVisit();
	else startCinematicVisit();
}

// show metadata or other info
function showInfoBox(title) {
    const el = document.getElementById("artwork-info");
    if (el) el.innerText = title;
}

function hideInfoBox() {
    // Stop any running cinematic tour before the room swaps, so artwork indices
    // from the old gallery can't leak into the new one.
    if (typeof stopCinematicVisit === 'function') stopCinematicVisit();

    // O episódio pertence à obra/galeria anterior; não deve continuar a tocar
    // quando o visitante sai da sala.
    if (typeof stopEpisodeAudio === 'function') {
        episodeRequestSerial++;
        stopEpisodeAudio();
    }

    const el = document.getElementById("artwork-info");
    if (el) el.innerText = "";
}



// Help popup functionality
function toggleHelp() {
    const helpPopup = document.getElementById('help-popup');
    helpPopup.style.display = helpPopup.style.display === 'none' ? 'block' : 'none';
}

function changeLanguage(lang) {
    // Remove active class from all language buttons and texts
    document.querySelectorAll('.lang-button').forEach(button => button.classList.remove('active'));
    document.querySelectorAll('.help-text').forEach(text => text.classList.remove('active'));
    
    // Add active class to selected language button and text
    document.querySelector(`.lang-button[onclick="changeLanguage('${lang}')"]`).classList.add('active');
    document.querySelector(`.help-text.${lang}`).classList.add('active');
}

// Load overlay content: CDN first, fall back to local
function loadOverlay() {
    // iconBase rewrites overlay.html's relative `icons/` paths to an absolute
    // base. Needed when the overlay is fetched from the CDN but injected into a
    // gallery page that doesn't bundle the icons (CDN/thin-client ZIP).
    const initOverlay = (html, iconBase) => {
        if (iconBase) {
            html = html.replace(/(src=["'])icons\//g, '$1' + iconBase + 'icons/');
        }
        document.body.insertAdjacentHTML('beforeend', html);
        const helpPopup = document.getElementById('help-popup');
        if (helpPopup) helpPopup.style.display = 'none';
        hideInfoBox();
        initEpisodeAudio();
    };

    const fetchText = (url) => fetch(url).then(r => {
        if (!r.ok) throw new Error('not found');
        return r.text();
    });

    const cdnBase = (typeof cdn_base !== 'undefined' && cdn_base) ? cdn_base : null;
    const cdnUrl = cdnBase ? cdnBase + '/core/overlay.html' : null;

    const promise = cdnUrl
        ? fetchText(cdnUrl).then(html => initOverlay(html, cdnBase + '/core/'))
            .catch(() => fetchText('overlay.html').then(html => initOverlay(html)))
        : fetchText('overlay.html').then(html => initOverlay(html));

    promise.catch(e => console.warn('Failed to load overlay:', e));
}

// If loaded dynamically (e.g. CDN ZIP), DOMContentLoaded has already fired — run immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadOverlay);
} else {
    loadOverlay();
}