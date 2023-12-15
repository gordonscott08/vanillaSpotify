//assign elements
const elInput = document.getElementById('userInput');
const elBtnResults = document.getElementById('submit');
const elBtnClear = document.getElementById('clear');
const elRawResults = document.getElementById('raw_results');
const elResultsDiv = document.getElementById('appendHere');

const clientId = spotifyClientId;
const redirectUrl = 'http://localhost:8000';

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
      } else {console.log('OK. No params.')};
    //if there were no parameters in the url, but there is no token, we need to initiate the full user permission / authentication process.
    if (!currentToken.access_token) {
        alert('Hang tight while we connect you to Spotify to authenticate your account.')
        redirectToSpotifyAuthorize();
    } else {console.log('OK. Existing token detected.')};
}
//once the hard stuff is done set the focus on the user input.
elInput.focus()

async function redirectToSpotifyAuthorize() {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = crypto.getRandomValues(new Uint8Array(64));
    const randomString = randomValues.reduce((acc, x) => acc + possible[x % possible.length], "");
    const authorizationEndpoint = "https://accounts.spotify.com/authorize";
    const scope = 'playlist-modify-public playlist-modify-private user-top-read';
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
        console.log(`First endpoint request didn't make contact: ${networkError.message}.`);
    }
}

/*
                <div class="song">
                    <div class="songText">
                        <h3>Song One</h3>
                        <h4>Artist</h4>
                        <h4>Album</h4>
                    </div>
                    <button class="addButton">Add</button>
                </div>
*/

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
        myAddButton.id = element.id;
        myAddButton.onclick = function() {handleAddClick(this.id)}
        myAddButton.innerText = 'Add'
        myTextContainer.appendChild(myh3);  //put the h3 element into the songText div
        myTextContainer.appendChild(myArtist);  //put the first h4 element into the songText div
        myTextContainer.appendChild(myAlbum);   //put the second h4 element into the songText div
        mySongContainer.appendChild(myTextContainer);   //append the SongText div to the top level div
        mySongContainer.appendChild(myAddButton);   //append the button to the top level div
        elementsArr.push(mySongContainer);
    });

    console.log(elementsArr.length);
    elementsArr.forEach((element) => {
        elResultsDiv.appendChild(element);
    })
}

function addToPlayList(id) {}




//handle the clear button
function clearResponse() {
    elResultsDiv.innerHTML = '';
    elInput.value = '';
    elInput.focus();
}

//handle Enter Key Press
function enterKeyHandler(event) {
    if (event.key === 'Enter') {
        searchSpotify();
    }
}

//clear input field after search results.
function clearInputs() {
    elInput.value = '';
}

function handleAddClick(id) {
    alert(`Received click for ID: ${id}.`)
}

//add Events
elBtnResults.addEventListener('click',searchSpotify);
elBtnClear.addEventListener('click',clearResponse);
elInput.addEventListener('keypress',enterKeyHandler);
window.addEventListener('load',handleLoad);