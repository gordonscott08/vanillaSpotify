//assign elements
const elInput = document.getElementById('userInput');
const elBtnResults = document.getElementById('submit');
const elBtnClear = document.getElementById('clear');
const elRawResults = document.getElementById('raw_results');
const elResultsDiv = document.getElementById('appendHere');
const elLoginDiv = document.getElementById('appendLogin');
const elBtnSubmitPlaylist = document.getElementById('submitPlaylistButton')
const playlistParentDiv = document.getElementById('appendPlayListHere');
const elEnteredPlaylistName = document.getElementById('userPlaylistName');
const elBtnNewSearch = document.getElementById('newSearchButton');
const savedMsg = document.getElementById('savedMessage');
const playlistSubmitBtn = document.getElementById('submitPlaylistButton');
const userInput = document.getElementById('userPlaylistName');
const newSearchBtn = document.getElementById('newSearchButton');

const testMode = false;
const clientId = 'e68bafb5cea6442ab13d02840d1862cc'; //this is public information
const redirectUrl = 'http://localhost:8000';

//Define user information
let spotifyUserId = '';     //will be populated by getUserId
let userPlaylistArr = [];   //will be populated with selected songs
let playlistId = '';        //will be populated by postNewPlaylsit

//on page load look for and save current url parameters. If present, they are part of authentication.
const params = new URLSearchParams(window.location.search);
const codeParam = params.get('code');
const stateParam = params.get('state');

//define token object, which will be provided as a response.
const currentToken = {
    get access_token() { return localStorage.getItem('access_token') || null; },
    get refresh_token() { return localStorage.getItem('refresh_token') || null; },
    get expires_in() { return localStorage.getItem('refresh_in') || null },
    get expires() { return localStorage.getItem('expires') || null },
  
    save: function (response) {
      const { access_token, refresh_token, expires_in } = response;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('expires_in', expires_in);
  
      const now = new Date();
      const expiry = new Date(now.getTime() + (expires_in * 1000));
      localStorage.setItem('expires', expiry);
    }
  };

async function handleLoad() {
    // if we found a code in our url, continue the authentication already in process
    if (codeParam) {
        if (stateParam != localStorage.getItem("sentStateParam")) {
            throw new Error ('Error. Returned State Parameter does not match Sent.');
        }
        console.log('OK. Query parameters detected. State param matched. Continuing authentication.')
        const token = await requestToken(codeParam);
        currentToken.save(token);
        // Remove the code from the URL so it's not visible and doesn't refresh to it.
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        const updatedUrl = url.search ? url.href : url.href.replace('?', '');
        window.history.replaceState({}, document.title, updatedUrl);
      } else {
        console.log('OK. No params.')
        //focus on search field
        elInput.focus()
    };
    //if there were no parameters in the url, but there is no token, we need to initiate the full user login / authentication process.
    if (!currentToken.access_token || testMode) {
        console.log('Rendering login.')
        renderLogin();
    } else {console.log('OK. Existing token detected.')};
}
//once the hard stuff is done set the focus on the user input.

function renderLogin() {
    const loginButton = document.createElement('button');
    loginButton.innerText = 'Login to Spotify';
    loginButton.className = 'largeButton';
    loginButton.onclick = handleLoginClick;
    const removeDiv = document.getElementById('searchElementsContainer');
    const alsoRemoveDiv = document.getElementById('submitContainer')
    removeDiv.remove();
    alsoRemoveDiv.remove();
    const myParent = document.getElementById('searchSection');
    myParent.appendChild(loginButton);
}

function handleLoginClick() {
    redirectToSpotifyAuthorize();
}

async function redirectToSpotifyAuthorize() {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = crypto.getRandomValues(new Uint8Array(64));
    const randomString = randomValues.reduce((acc, x) => acc + possible[x % possible.length], "");
    const authorizationEndpoint = "https://accounts.spotify.com/authorize";
    const scope = 'playlist-modify-public playlist-modify-private user-top-read user-read-email user-read-private';
    const randomState = Math.floor(Math.random()*1000000)
    localStorage.setItem("sentStateParam",randomState);
  
    const code_verifier = randomString;
    const data = new TextEncoder().encode(code_verifier);
    const hashed = await crypto.subtle.digest('SHA-256', data);
  
    const code_challenge_base64 = btoa(String.fromCharCode(...new Uint8Array(hashed)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  
    window.localStorage.setItem('code_verifier', code_verifier);
  
    const authUrl = new URL(authorizationEndpoint)
    const params = {
      response_type: 'code',
      client_id: clientId,
      scope: scope,
      code_challenge_method: 'S256',
      code_challenge: code_challenge_base64,
      redirect_uri: redirectUrl,
      state: randomState,
    };
  
    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString(); // Redirect the user to the authorization server for login
  }

async function requestToken() {
    const url = "https://accounts.spotify.com/api/token";
    const code_verifier = localStorage.getItem('code_verifier');

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: clientId,
              grant_type: 'authorization_code',
              code: codeParam,
              redirect_uri: redirectUrl,
              code_verifier: code_verifier,
            }),
          });
        if (response.ok) {
            console.log('Success. Token generated.')
            return await response.json();
        }
        else {
            throw new Error(`Error. Response came back with status ${response.status}`);
        }
    } catch(networkError) {
        console.log(networkError.message);
    }
}

async function refreshToken() {
    const url = "https://accounts.spotify.com/api/token";
    console.log('Beginning token refresh...')
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              client_id: clientId,
              grant_type: 'refresh_token',
              refresh_token: currentToken.refresh_token
            }),
          });
          if (response.ok) {
            console.log('Success. Token generated.')
            const token = await response.json();
            currentToken.save(token);
            return token;
        }
        else {
            throw new Error(`Token Refresh Error. Response is status ${response.status}`);
        }          
    } catch(error) {`Connection error on refreshToken: ${error.message}`}
  }

async function searchSpotify () {
    const baseUrl = 'https://api.spotify.com/v1';
    const endpoint = '/search?';
    const userInput = elInput.value;
    const queryParam = 'q=' + encodeURIComponent(userInput);
    const typeParam = '&type=' + encodeURIComponent('track');
    const extendedUrl = baseUrl + endpoint + queryParam + typeParam;
    const clientCredential = currentToken.access_token;

    if (!elInput.value) {
        alert('Please enter a search term first.')
        elInput.focus();
        return
    }
    try {
        const response = await fetch(extendedUrl,{
            method: 'GET',
            headers: {
                'Authorization' : 'Bearer ' + clientCredential
            }
        });
        //if the response is ok...render results.
        if (response.ok) {
            console.log(`OK. Token accepted. Response ${response.status}.`)
            const jsonResponse = await response.json();
            renderList(jsonResponse);
        //if the token is expired...generate a new token and try one more time.
        } else if (response.status === 401) {
            console.log(`Token is expired. Requesting new token...`);
            try {
                const newTokenResponse = await refreshToken();
                console.log('Making second request to endpoint...');
                try {
                    const secondTryResponse = await fetch(extendedUrl,{
                        method: 'GET',
                        headers: {
                            'Authorization' : 'Bearer ' + newTokenResponse.access_token
                        }
                    });
                if (secondTryResponse.ok) {
                    console.log(`Success: second endpoint attempt; response ${secondTryResponse.status}.`);
                    const secondTryJson = await secondTryResponse.json();
                    renderList(secondTryJson);
                } else {
                    console.log(`Error on second endpoint request. Response ${response.status}`)
                }
                } catch(err) {console.log(`Second attempt at endpoint hit an error: ${err.message}`)}
            } catch(tokenGenerationError) {
                console.log(`New token generation hit an error: ${tokenGenerationError.message}.`)
            }
        } else {console.log(`First endpoint request came back from Spotify with status ${response.status}.`)}
    } catch(networkError) {
        console.log(`We hit a general error: ${networkError.message}.`);
    }
}


async function getUserId() {
    const baseUrl = 'https://api.spotify.com/v1';
    const endpoint = '/me';
    const extendedUrl = baseUrl + endpoint;
    const clientCredential = currentToken.access_token;

    try {
        const response = await fetch(extendedUrl,{
            method: 'GET',
            headers: {
                'Authorization' : 'Bearer ' + clientCredential
            }
        });
        if (response.ok) {
            console.log(`OK. Token accepted. Response ${response.status}.`)
            const jsonResponse = await response.json();
            spotifyUserId = jsonResponse.id;
            console.log(jsonResponse);
        //if the token is expired...generate a new token and try one more time.
        } else if (response.status === 401) {
            console.log(`Token is expired. Requesting new token...`);
            try {
                const newTokenResponse = await refreshToken();
                console.log('Making second request to endpoint...');
                try {
                    const secondTryResponse = await fetch(extendedUrl,{
                        method: 'GET',
                        headers: {
                            'Authorization' : 'Bearer ' + newTokenResponse.access_token
                        }
                    });
                if (secondTryResponse.ok) {
                    console.log(`Success: second endpoint attempt; response ${secondTryResponse.status}.`);
                    const secondTryJson = await secondTryResponse.json();
                    spotifyUserId = secondTryJson.id;
                    console.log(secondTryJson);
                } else {
                    console.log(`Error on second endpoint request. Response ${response.status}`)
                }
                } catch(err) {console.log(`Second attempt at endpoint hit an error: ${err.message}`)}
            } catch(tokenGenerationError) {
                console.log(`New token generation hit an error: ${tokenGenerationError.message}.`)
            }
        } else {console.log(`First endpoint request came back from Spotify with status ${response.status}.`)}
    } catch(networkError) {
        console.log(`We hit a general error: ${networkError.message}.`);
    }
}

async function postNewPlaylist (playlistName) {
    const baseUrl = 'https://api.spotify.com/v1';
    const endpoint = '/users/'+spotifyUserId+'/playlists';
    const extendedUrl = baseUrl + endpoint;
    const clientCredential = currentToken.access_token;
    const requestBody = JSON.stringify({name: playlistName});

    try {
        const response = await fetch(extendedUrl,{
            method: 'POST',
            headers: {
                'Authorization' : 'Bearer ' + clientCredential,
                'Content-Type': 'application/json',
            },
            body: requestBody,
        });
        if (response.ok) {
            console.log(`OK. Token accepted. Response ${response.status}.`)
            const jsonResponse = await response.json();
            playlistId = jsonResponse.id;
            console.log(jsonResponse);
        //if the token is expired...generate a new token and try one more time.
        } else if (response.status === 401) {
            console.log(`Token is expired. Requesting new token...`);
            try {
                const newTokenResponse = await refreshToken();
                console.log('Making second request to endpoint...');
                try {
                    const secondTryResponse = await fetch(extendedUrl,{
                        method: 'GET',
                        headers: {
                            'Authorization' : 'Bearer ' + newTokenResponse.access_token
                        }
                    });
                if (secondTryResponse.ok) {
                    console.log(`Success: second endpoint attempt; response ${secondTryResponse.status}.`);
                    const secondTryJson = await secondTryResponse.json();
                    playlistId = secondTryJson.id;
                    console.log(secondTryJson);
                } else {
                    console.log(`Error on second endpoint request. Response ${response.status}`)
                }
                } catch(err) {console.log(`Second attempt at endpoint hit an error: ${err.message}`)}
            } catch(tokenGenerationError) {
                console.log(`New token generation hit an error: ${tokenGenerationError.message}.`)
            }
        } else {console.log(`First endpoint request came back from Spotify with status ${response.status}.`)}
    } catch(networkError) {
        console.log(`We hit a general error: ${networkError.message}.`);
    }
}


async function postTracksToPlaylist () {
    const baseUrl = 'https://api.spotify.com/v1';
    const endpoint = '/playlists/'+playlistId+'/tracks';
    const extendedUrl = baseUrl + endpoint;
    const clientCredential = currentToken.access_token;
    const formattedTracksArr = userPlaylistArr.map((item)=> 'spotify:track:'+item);
    const requestBody = JSON.stringify({uris: formattedTracksArr});

    try {
        const response = await fetch(extendedUrl,{
            method: 'POST',
            headers: {
                'Authorization' : 'Bearer ' + clientCredential,
                'Content-Type': 'application/json',
            },
            body: requestBody,
        });
        if (response.ok) {
            console.log(`OK. Token accepted. Response ${response.status}.`)
            const jsonResponse = await response.json();
            console.log(jsonResponse);
        //if the token is expired...generate a new token and try one more time.
        } else if (response.status === 401) {
            console.log(`Token is expired. Requesting new token...`);
            try {
                const newTokenResponse = await refreshToken();
                console.log('Making second request to endpoint...');
                try {
                    const secondTryResponse = await fetch(extendedUrl,{
                        method: 'GET',
                        headers: {
                            'Authorization' : 'Bearer ' + newTokenResponse.access_token
                        }
                    });
                if (secondTryResponse.ok) {
                    console.log(`Success: second endpoint attempt; response ${secondTryResponse.status}.`);
                    const secondTryJson = await secondTryResponse.json();
                    console.log(secondTryJson);
                } else {
                    console.log(`Error on second endpoint request. Response ${response.status}`)
                }
                } catch(err) {console.log(`Second attempt at endpoint hit an error: ${err.message}`)}
            } catch(tokenGenerationError) {
                console.log(`New token generation hit an error: ${tokenGenerationError.message}.`)
            }
        } else {console.log(`First endpoint request came back from Spotify with status ${response.status}.`)}
    } catch(networkError) {
        console.log(`We hit a general error: ${networkError.message}.`);
    }
}


function renderList(responseObj) {
    const tracksArr = responseObj.tracks.items;
    elResultsDiv.innerHTML = '';
    const elementsArr = [];

    tracksArr.forEach(element => {
        const mySongContainer = document.createElement('div');  //create the top level "song" div
        mySongContainer.className = 'song';    
        const myTextContainer = document.createElement('div'); //create the "songText" div
        myTextContainer.className = 'songText';
        const myh3 = document.createElement('h3');
        myh3.innerText = element.name;
        const myArtist = document.createElement('h4');
        myArtist.innerText = element.artists[0].name;
        const myAlbum = document.createElement('h4');
        myAlbum.innerText = element.album.name;
        const myAddButton = document.createElement('button');
        myAddButton.className = 'addButton';
        myAddButton.id = 'buttonFor_'+element.id;
        myAddButton.setAttribute('trackId',element.id)
        myAddButton.setAttribute('track',element.name);
        myAddButton.setAttribute('artist',element.artists[0].name)
        myAddButton.setAttribute('album',element.album.name)
        myAddButton.onclick = function() {handleAddClick(this.getAttribute('trackId'), this.getAttribute('track'), this.getAttribute('artist'), this.getAttribute('album'))}
        myAddButton.innerText = 'Add'
        myTextContainer.appendChild(myh3);  //put the h3 element into the songText div
        myTextContainer.appendChild(myArtist);  //put the first h4 element into the songText div
        myTextContainer.appendChild(myAlbum);   //put the second h4 element into the songText div
        mySongContainer.appendChild(myTextContainer);   //append the SongText div to the top level div
        mySongContainer.appendChild(myAddButton);   //append the button to the top level div
        elementsArr.push(mySongContainer);
    });

    elementsArr.forEach((element) => {
        elResultsDiv.appendChild(element);
    })
}

//
function handleClearSearch() {
    elResultsDiv.innerHTML = '';
    elInput.value = '';
    elInput.focus();
}

function enterKeyHandler(event) {
    if (event.key === 'Enter') {
        searchSpotify();
    }
}

function handleAddClick(id, track, artist, album) {
    //alert(`ID: ${id}, track: ${track}, artist: ${artist}, album: ${album}`);
    const mySongContainer = document.createElement('div');  //create the top level "song" div
        mySongContainer.className = 'song';
        mySongContainer.id = 'containerFor_' + id;    
        const myTextContainer = document.createElement('div'); //create the "songText" div
        myTextContainer.className = 'songText';
        const myh3 = document.createElement('h3');
        myh3.innerText = track;
        const myArtist = document.createElement('h4');
        myArtist.innerText = artist;
        const myAlbum = document.createElement('h4');
        myAlbum.innerText = album;
        const myAddButton = document.createElement('button');
        myAddButton.setAttribute('trackId',id);
        myAddButton.className = 'addButton';
        myAddButton.id = 'removeBtnFor_'+id;
        myAddButton.innerText = 'Remove';
        myAddButton.onclick = function() {handleRemove(this.getAttribute('trackId'))}
        myTextContainer.appendChild(myh3);  //put the h3 element into the songText div
        myTextContainer.appendChild(myArtist);  //put the first h4 element into the songText div
        myTextContainer.appendChild(myAlbum);   //put the second h4 element into the songText div
        mySongContainer.appendChild(myTextContainer);   //append the SongText div to the top level div
        mySongContainer.appendChild(myAddButton);   //append the button to the top level div
        playlistParentDiv.appendChild(mySongContainer); //append the whole thing to the playlist div
        userPlaylistArr.push(id);   //add the song to the user's playlist array
        console.log(userPlaylistArr);
}

function handleRemove(id) {
    const removedSongDiv = document.getElementById('containerFor_' + id);
    console.log(removedSongDiv);
    removedSongDiv.remove();
    const updatedArr = userPlaylistArr.filter(item=>item !== id);
    userPlaylistArr = updatedArr;
    console.log(userPlaylistArr);
}

async function handlePlaylistSubmit() {
    //if the name of the playlist is blank, alert the user.
    if (!elEnteredPlaylistName.value) {
        alert('Please enter a name first.')
        elEnteredPlaylistName.focus();
        return
    }

    console.log('OK. Requesting user ID.')
    await getUserId();
    console.log('Sending playlist name as: ' + elEnteredPlaylistName.value);
    await postNewPlaylist(elEnteredPlaylistName.value);
    await postTracksToPlaylist();
    
    savedMsg.style.display = 'block';
    newSearchBtn.style.display = 'block';
    playlistSubmitBtn.style.display = 'none';
    userInput.style.display = 'none';
}

function handleNewSearch() {
    spotifyUserId = '';
    userPlaylistArr = [];
    playlistId = '';
    playlistParentDiv.innerHTML = '';
    elResultsDiv.innerHTML = '';
    elInput.value = '';
    elEnteredPlaylistName.value = '';
    elInput.focus();
    savedMsg.style.display = 'none';
    newSearchBtn.style.display = 'none';
    playlistSubmitBtn.style.display = 'block';
    userInput.style.display = 'block';
}

//add Event Listeners
elBtnResults.addEventListener('click',searchSpotify);
elBtnClear.addEventListener('click',handleClearSearch);
elInput.addEventListener('keypress',enterKeyHandler);
elBtnSubmitPlaylist.addEventListener('click',handlePlaylistSubmit);
elBtnNewSearch.addEventListener('click',handleNewSearch);
window.addEventListener('load',handleLoad);