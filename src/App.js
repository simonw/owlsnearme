import React, { Component } from 'react';
import './x-near-you.css';
import { get } from 'axios';
import { Map, TileLayer } from 'react-leaflet';
import moment from 'moment-es6';

const GEO_PLANET_CONTINENT = 29;

const cleanPlaces = (places) => {
  return places.map(({bounding_box_geojson, name, display_name, id, place_type}) => {
    return {bounding_box_geojson, name, display_name, id, place_type};
  });
}

const LoadingDots = (props) => {
  // Adapted from http://samherbert.net/svg-loaders/ by @samh
  return (
    <svg style={props.style} width={props.width || 120} height={props.height || 30} viewBox="0 0 120 30" fill={props.fill || '#fff'}>
      <circle cx="15" cy="15" r="15">
          <animate attributeName="r" from="15" to="15"
                   begin="0s" dur="0.8s"
                   values="15;9;15" calcMode="linear"
                   repeatCount="indefinite" />
          <animate attributeName="fill-opacity" from="1" to="1"
                   begin="0s" dur="0.8s"
                   values="1;.5;1" calcMode="linear"
                   repeatCount="indefinite" />
      </circle>
      <circle cx="60" cy="15" r="9" fillOpacity="0.3">
          <animate attributeName="r" from="9" to="9"
                   begin="0s" dur="0.8s"
                   values="9;15;9" calcMode="linear"
                   repeatCount="indefinite" />
          <animate attributeName="fill-opacity" from="0.5" to="0.5"
                   begin="0s" dur="0.8s"
                   values=".5;1;.5" calcMode="linear"
                   repeatCount="indefinite" />
      </circle>
      <circle cx="105" cy="15" r="15">
          <animate attributeName="r" from="15" to="15"
                   begin="0s" dur="0.8s"
                   values="15;9;15" calcMode="linear"
                   repeatCount="indefinite" />
          <animate attributeName="fill-opacity" from="1" to="1"
                   begin="0s" dur="0.8s"
                   values="1;.5;1" calcMode="linear"
                   repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

const cleanPlace = place => {
  var swlat, swlng, nelat, nelng, lat, lng;
  lat = parseFloat(place.location.split(',')[0]);
  lng = parseFloat(place.location.split(',')[0]);
  if (place.bounding_box_geojson) {
    place.bounding_box_geojson.coordinates[0].forEach(p => {
      let lng = p[0];
      let lat = p[1];
      swlat = swlat ? Math.min(swlat, lat) : lat;
      swlng = swlng ? Math.min(swlng, lng) : lng;
      nelat = nelat ? Math.max(nelat, lat) : lat;
      nelng = nelng ? Math.max(nelng, lng) : lng;
    });
  }
  return {
    swlat,
    swlng,
    nelat,
    nelng,
    lat,
    lng,
    displayName: place.display_name,
    shortName: place.name,
    id: place.id
  }
}

const parseQueryString = (s) => {
  return s.slice(1).split('&').map((queryParam) => {
    let pair = queryParam.split('=');
    return {key: pair[0], value: pair[1]};
  }).reduce((query, pair) => {
    pair.key && (query[pair.key] = pair.value);
    return query;
  }, {});
}

const haversine_distance_km = (lat1, lon1, lat2, lon2) => {
    const world_radius_km = 6371;
    const p = Math.PI / 180;
    const a = (
        0.5 - Math.cos((lat2 - lat1) * p) / 2 +
        Math.cos(lat1 * p) * Math.cos(lat2 * p) *
        (1 - Math.cos((lon2 - lon1) * p)) / 2
    );
    return world_radius_km * 2 * Math.asin(Math.sqrt(a));
}

const PlaceCrumbs = (props) => {
  if (!props.places || props.places.length < 2) {
    return null;
  }
  return (
    <ol className="place-crumbs meta">{props.places.map(p => {
      return (
        <li><a href={`/?place=${p.id}`}>{p.name}</a></li>
      )
    })}</ol>
  );
}

class CustomMap extends Component {
  componentDidMount() {
    this.disableMap();
  }
  disableMap() {
    if (!this.leafletMap) {
      return;
    }
    this.leafletMap.leafletElement.dragging.disable();
    this.leafletMap.leafletElement.touchZoom.disable();
    this.leafletMap.leafletElement.doubleClickZoom.disable();
    this.leafletMap.leafletElement.scrollWheelZoom.disable();
    this.leafletMap.leafletElement.boxZoom.disable();
    this.leafletMap.leafletElement.keyboard.disable();
    if (this.leafletMap.leafletElement.tap) {
      this.leafletMap.leafletElement.tap.disable();
    }
  }
  render() {
    let dynamicProps = {
      ref: (r) => { this.leafletMap = r; },
      zoomControl: false
    };
    if (this.props.bounds) {
      dynamicProps.bounds = this.props.bounds;
    } else {
      dynamicProps.center = this.props.center;
      dynamicProps.zoom = this.props.zoom;
    }
    return (
      <Map {...dynamicProps}>
        <TileLayer
          attribution="&amp;copy <a href=&quot;https://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />,
        <TileLayer
          attribution="<a href=&quot;https://www.inaturalist.org/&quot;>iNaturalist</a>"
          url={`https://api.inaturalist.org/v1/colored_heatmap/{z}/{x}/{y}.png?taxon_id=${this.props.taxon_id}`}
        />
      </Map>
    );
  }
}

class App extends Component {
  state = {
    standardPlaces: [],
    communityPlaces: [],
    placesLoading: false,
    locationLoading: false,
    noPlaceResultsFor: null,
    placeName: null,
    places: [],
    species: [],
    observations: [],
    place_id: null,
    lng: null,
    lat: null,
    nelat: null,
    nelng: null,
    swlat: null,
    swlng: null,
    q: null,
    taxon_id: 19350
  }
  fetchPlaceData(lat, lng) {
    get(
      'https://api.inaturalist.org/v1/places/nearby', {
        params: {
          nelat: lat,
          nelng: lng,
          swlat: lat,
          swlng: lng
        }
      }
    ).then(response => {
      this.setState({
        standardPlaces: cleanPlaces(response.data.results.standard).filter(
          p => p.place_type !== GEO_PLANET_CONTINENT
        ),
        communityPlaces: cleanPlaces(response.data.results.community),
        placeName: cleanPlaces(response.data.results.standard).slice(-1)[0].name
      });
    });
  }
  fetchSpeciesData() {
    // Prefers nelat/nelng/swlat/swlng to lat/lng
    if (!this.state.nelat && !this.state.lat && !this.state.place_id) {
      return;
    }
    let location = {};
    if (this.state.place_id) {
      location.place_id = this.state.place_id;
    } else if (this.state.nelat) {
      location = {
        nelat: this.state.nelat,
        nelng: this.state.nelng,
        swlat: this.state.swlat,
        swlng: this.state.swlng
      };
    } else {
      location = {
        lat: this.state.lat,
        lng: this.state.lng,
        radius: 50
      };
    };
    get(
      'https://api.inaturalist.org/v1/observations/species_counts', {
        params: {
          taxon_id: this.state.taxon_id,
          quality_grade: 'research',
          ...location
        }
      }
    ).then(response => {
      const species = response.data.results.map(r => {
        return {
          count: r.count,
          common_name: r.taxon.preferred_common_name,
          name: r.taxon.name,
          image: r.taxon.default_photo.medium_url,
          id: r.taxon.id
        }
      });
      if (species.length) {
        this.setState({species});
      } else if (!this.state.lng) {
        // If no results, switch to lat/lng/radius search instead
        this.setState({
          swlat: null,
          swlng: null,
          nelat: null,
          nelng: null,
          place_id: null,
          lat: this.state.swlat + ((this.state.nelat - this.state.swlat) / 2),
          lng: this.state.swlng + ((this.state.nelng - this.state.swlng) / 2)
        }, () => {
          this.fetchSpeciesData();
        });
      }
    });
    get(
      'https://api.inaturalist.org/v1/observations', {
        params: {
          taxon_id: this.state.taxon_id,
          order_by: 'observed_on',
          ...location,
          photos: true
        }
      }
    ).then(response => {
      this.setState({observations: response.data.results.map(o => {
        let distance_km = null;
        if (this.state.lat && o.location) {
          distance_km = haversine_distance_km(
            this.state.lat, this.state.lng,
            parseFloat(o.location.split(',')[0]),
            parseFloat(o.location.split(',')[1]),
          );
        }
        return {
          time_observed_at: moment(o.time_observed_at).format('MMMM Do YYYY, h:mma'),
          time_observed_ago: moment(o.time_observed_at).fromNow(),
          image_square: o.photos[0].url,
          image_medium: o.photos[0].url.replace('square.', 'medium.'),
          common_name: o.taxon.preferred_common_name,
          name: o.taxon.name,
          uri: o.uri,
          user_name: o.user.name,
          user_login: o.user.login,
          place_guess: o.place_guess,
          is_research: o.quality_grade === 'research',
          distance_km
        }
      })});
    });
  }
  loadPlaceCrumbs(placeIds) {
    get(
      `https://api.inaturalist.org/v1/places/${placeIds.join(',')}`
    ).then(response => {
      let places = cleanPlaces(response.data.results);
      // Filter out continents
      places = places.filter((p) => p.place_type !== GEO_PLANET_CONTINENT);
      places.sort((a, b) => {
        return placeIds.indexOf(a.id) - placeIds.indexOf(b.id);
      });
      this.setState({
        standardPlaces: places
      });
    });
  }
  setPlace(placeId) {
    get(
      `https://api.inaturalist.org/v1/places/${placeId}`
    ).then(response => {
      const place = cleanPlace(response.data.results[0]);
      // Kick off request for ancestors for breadcrumbs
      this.loadPlaceCrumbs(response.data.results[0].ancestor_place_ids);
      this.setState({
        swlat: place.swlat,
        swlng: place.swlng,
        nelat: place.nelat,
        nelng: place.nelng,
        placeName: place.displayName,
        place_id: place.id
      }, () => {
        this.fetchSpeciesData();
      });
    });
  }
  componentDidMount() {
    const bits = parseQueryString(window.location.search);
    if (bits.place) {
      this.setPlace(bits.place);
    }
    if (bits.taxon_id) {
      this.setState({taxon_id: bits.taxon_id})
    }
    this.setState({bits});
  }
  onPlaceSearchSubmit(ev) {
    ev.preventDefault();
    let q = this.state.q;
    this.setState({
      placesLoading: true,
      noPlaceResultsFor: null
    });
    get(
      'https://api.inaturalist.org/v1/places/autocomplete', {
        params: {
          q
        }
      }
    ).then(response => {
      const places = response.data.results.filter(
        r => r.bounding_box_geojson
      ).map(cleanPlace);
      let noPlaceResultsFor = null;
      if (places.length === 0) {
        noPlaceResultsFor = q;
      }
      this.setState({
        places,
        placesLoading: false,
        noPlaceResultsFor: noPlaceResultsFor
      });
      // this.fetchSpeciesData();
    });
  }
  onTextChange(ev) {
    this.setState({
      q: ev.target.value
    });
  }
  onDeviceLocationClick() {
    this.setState({locationLoading: true});
    window.navigator.geolocation.getCurrentPosition((position) => {
      this.setState({
        locationLoading: false,
        swlat: null,
        swlng: null,
        nelat: null,
        nelng: null,
        place_id: null,
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }, () => {
        this.fetchSpeciesData();
      });
      this.fetchPlaceData(position.coords.latitude, position.coords.longitude);
    });
  }
  render() {
    let map = null;
    if (this.state.swlat) {
      const bounds = [
        [this.state.swlat, this.state.swlng],
        [this.state.nelat, this.state.nelng]
      ];
      map = <CustomMap bounds={bounds} taxon_id={this.state.taxon_id} />;
    } else if (this.state.lat) {
      map = <CustomMap
        center={[this.state.lat, this.state.lng]}
        zoom={12}
        taxon_id={this.state.taxon_id}
      />;
    }
    const deviceLocationButton = window.navigator.geolocation && (
      <div className="locate-me">
        <button
          type="button"
          className="submit"
          onClick={this.onDeviceLocationClick.bind(this)}>
          Use my location
          {this.state.locationLoading && <LoadingDots fill="#fff" style={{height: '0.8rem'}} />}
        </button>

      </div>
    );
    const inOrNear = this.state.swlat ? 'in' : 'near';
    let pageTitle = 'Find owls near me!';
    let pageHeader = <h1>{pageTitle}</h1>;
    if (this.state.placeName) {
      pageTitle = `Owls ${inOrNear} ${this.state.placeName}`;
      pageHeader = <h1>Owls {inOrNear} <em>{this.state.placeName}</em></h1>;
    }

    document.title = pageTitle;
    return (<div>
      <section className="primary">
        <div className="inner">
          {pageHeader}
          <PlaceCrumbs places={this.state.standardPlaces} />
          <form action="/" method="GET" onSubmit={this.onPlaceSearchSubmit.bind(this)}>
            <div className="search-form">
              <label><span>Search for a place</span><input
                type="text"
                size={30}
                title="Location"
                className="text"
                name="q"
                onChange={this.onTextChange.bind(this)}
                placeholder={this.state.placeName ? "Search somewhere else" : "Search for a place"}
                value={this.state.q || ''}
              /></label>

              <button type="submit" className="submit">Go</button>
              {this.state.noPlaceResultsFor && <div class="search-suggest">
                <div>No places found for "{this.state.noPlaceResultsFor}"</div>
              </div>}
              {this.state.places.length !== 0 && <div class="search-suggest">
                {this.state.places.map(place => {
                  return <div>
                    <a href={`?place=${place.id}`}>{place.displayName}</a>
                  </div>
                })}
              </div>}
              {this.state.placesLoading && <LoadingDots fill="#B04C5E" style={{
                position: 'absolute',
                top: '0.6rem',
                right: '3rem',
                height: '1rem'
              }} />}
              </div>
              {deviceLocationButton}
          </form>

          {this.state.species.length !== 0 && <div className={`species-list ${this.state.species.length <= 4 ? 'species-list-mini' : ''}`}>
            {/* Species list */}
            {this.state.species.map((s) => (
              <div className="species" key={s.id}>
                <div className="species-content">
                  <div className="img"><a href={`https://www.inaturalist.org/taxa/${s.id}`}><img src={s.image} alt={s.common_name} /></a></div>
                  <h3 className="title">{s.common_name} <em className="species-name">{s.name}</em></h3>
                </div>
                <p className="species-context">Spotted {s.count} times nearby</p>
              </div>
            ))}
          </div>}

        </div>
      </section>

      <section className="tertiary map">
        {map}
      </section>

      {this.state.observations.length !== 0 && <section className="secondary">
        <div className="inner">

          <h2>Recently spotted</h2>

            {this.state.observations.map((o) => (
              <div className="observation" key={o.uri}>
                <div className="img"><a href={o.uri}><img src={o.image_medium} alt="view observation of {o.common_name} on iNaturalist" /></a></div>
                <h3 className="title"><a href={o.uri}>{o.common_name}</a> <em className="observation-species">{o.name}</em></h3>
                <p>Spotted by <a href={`https://www.inaturalist.org/people/${o.user_login}`}>{o.user_name || o.user_login }</a> {o.distance_km && <span>&nbsp;{`${(o.distance_km * (1000/1600)).toFixed(1)} miles away`}&nbsp;</span>} in {o.place_guess} <span title={o.time_observed_at}>{o.time_observed_ago}</span>.</p>
                <p>
                  {o.is_research ? (
                    <span className="verify">Verified observation</span>
                  ) : (
                    <a className="verify help-needed" href={o.uri}>Help verify observation</a>
                  )}
                </p>

              </div>
            ))}
        </div>
      </section>}

      <section className="footer">
        <div className="inner">
          <p className="meta">by <a href="https://www.inaturalist.org/people/natbat">Natalie Downe</a> and <a href="https://www.inaturalist.org/people/simonw">Simon Willison</a> using data from <a href="https://www.inaturalist.org/">iNaturalist</a></p>
        </div>
      </section>
      {window.localStorage && window.localStorage.getItem('debug') && <section className="tertiary">
        <div className="inner">
          <h2>Debug information</h2>
          <pre>
            {JSON.stringify(this.state, null, 2)}
          </pre>
        </div>
      </section>}
    </div>);
  }
}
export default App;
