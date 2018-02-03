import React, { Component } from 'react';
import './App.css';
import { get } from 'axios';
import { Map, TileLayer } from 'react-leaflet';
import moment from 'moment-es6';

const cleanPlaces = (places) => {
  return places.map(({bounding_box_geojson, name, display_name}) => {
    return {bounding_box_geojson, name, display_name};
  });
}

class App extends Component {
  state = {
    standardPlaces: [],
    communityPlaces: [],
    placeName: null,
    /* Tokyo:
    lat: 35.66,
    lng: 139.781
    */
    lng: null,//-122.4494224,
    lat: null,//37.8022071
    nelat: null,
    nelng: null,
    swlat: null,
    swlng: null,
    q: null
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
        standardPlaces: cleanPlaces(response.data.results.standard),
        communityPlaces: cleanPlaces(response.data.results.community),
      });
    });
  }
  fetchSpeciesData() {
    // Prefers nelat/nelng/swlat/swlng to lat/lng
    if (!this.state.nelat && !this.state.lat) {
      return;
    }
    const location = this.state.nelat ? {
      nelat: this.state.nelat,
      nelng: this.state.nelng,
      swlat: this.state.swlat,
      swlng: this.state.swlng
    } : {
      lat: this.state.lat,
      lng: this.state.lng,
      radius: 50
    };
    get(
      'https://api.inaturalist.org/v1/observations/species_counts', {
        params: {
          taxon_id: 19350,
          ...location
        }
      }
    ).then(response => {
      this.setState({species: response.data.results.map(r => {
        return {
          count: r.count,
          common_name: r.taxon.preferred_common_name,
          name: r.taxon.name,
          image: r.taxon.default_photo.square_url.replace('_s.', '_q.'),
          id: r.taxon.id
        }
      })});
    });
    get(
      'https://api.inaturalist.org/v1/observations', {
        params: {
          taxon_id: 19350,
          order_by: 'observed_on',
          ...location,
          photos: true
        }
      }
    ).then(response => {
      this.setState({observations: response.data.results.map(o => {
        return {
          time_observed_at: moment(o.time_observed_at).format('MMMM Do YYYY, h:mm:ss a'),
          image_square: o.photos[0].url,
          image_medium: o.photos[0].url.replace('square.', 'medium.'),
          common_name: o.taxon.preferred_common_name,
          name: o.taxon.name,
          uri: o.uri,
          user_name: o.user.name,
          user_login: o.user.login
        }
      })});
    });
  }
  componentDidMount() {
    this.fetchSpeciesData();
  }
  onSubmit(ev) {
    ev.preventDefault();
    get(
      'https://api.inaturalist.org/v1/places/autocomplete', {
        params: {
          q: this.state.q
        }
      }
    ).then(response => {
      const results = response.data.results;
      if (results.length) {
        this.setState({
          lat: parseFloat(results[0].location.split(',')[0]),
          lng: parseFloat(results[0].location.split(',')[1]),
          placeName: results[0].display_name
        });
        this.fetchSpeciesData();
      }
    });
  }
  onTextChange(ev) {
    this.setState({
      q: ev.target.value
    });
  }
  render() {
    const position = this.state.lat && [this.state.lat, this.state.lng];
    return (
      <div className="App">
        <form action="/" method="GET" onSubmit={this.onSubmit.bind(this)}>
          <input type="search"
            onChange={this.onTextChange.bind(this)}
            placeholder="Search for a place, e.g. San Francisco"
            value={this.state.q}
          />
          <input type="submit" value="Search" />
        </form>
        {position && <Map center={position} zoom={12}>
          <TileLayer
            attribution="&amp;copy <a href=&quot;https://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <TileLayer
            attribution="<a href=&quot;https://www.inaturalist.org/&quot;>iNaturalist</a>"
            url="https://api.inaturalist.org/v1/colored_heatmap/{z}/{x}/{y}.png?taxon_id=19350"
          />
        </Map>}
        {this.state.observations && <div>
          {this.state.observations.map((o) => (
            <div className="species" key={o.uri}>
              <a href={o.uri}><img src={o.image_medium} alt={o.common_name} /></a>
              <h3>{o.common_name}</h3>
              <p><em>{o.name}</em> spotted by {o.user_name || o.user_login } on {o.time_observed_at}</p>
            </div>
          ))}
        </div>}
        {this.state.species && <div>
          <h2>Owls you might see here...</h2>
          {this.state.species.map((s) => (
            <div className="species" key={s.id}>
              <a href={`https://www.inaturalist.org/species/${s.id}`}><img src={s.image} alt={s.common_name} /></a>
              <h3>{s.common_name}</h3>
              <p><em>{s.name}</em> spotted {s.count} times</p>
            </div>
          ))}
        </div>}
        <pre>
          {JSON.stringify(this.state, null, 2)}
        </pre>
      </div>
    );
  }
}

export default App;
