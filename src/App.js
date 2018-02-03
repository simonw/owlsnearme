import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import { get } from 'axios';

const cleanPlaces = (places) => {
  return places.map(({bounding_box_geojson, name, display_name}) => {
    return {bounding_box_geojson, name, display_name};
  });
}

class App extends Component {
  state = {
    standardPlaces: [],
    communityPlaces: [],
    /* Tokyo:
    lat: 35.66,
    lng: 139.781
    */
    lng: -122.4494224,
    lat: 37.8022071
  }
  componentDidMount() {
    get(
      'https://api.inaturalist.org/v1/places/nearby', {
        params: {
          nelat: this.state.lat,
          nelng: this.state.lng,
          swlat: this.state.lat,
          swlng: this.state.lng
        }
      }
    ).then(response => {
      this.setState({
        standardPlaces: cleanPlaces(response.data.results.standard),
        communityPlaces: cleanPlaces(response.data.results.community),
        // results: response.data.results
      });
    });
    get(
      'https://api.inaturalist.org/v1/observations/species_counts', {
        params: {
          taxon_id: 19350,
          lat: this.state.lat,
          lng: this.state.lng,
          radius: 50
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
          lat: this.state.lat,
          lng: this.state.lng,
          radius: 50,
          photos: true
        }
      }
    ).then(response => {
      this.setState({observations: response.data.results.map(o => {
        return {
          time_observed_at: o.time_observed_at,
          image_square: o.photos[0].url,
          image_medium: o.photos[0].url.replace('square.jpg', 'medium.jpg'),
          common_name: o.taxon.preferred_common_name,
          name: o.taxon.name,
          uri: o.uri,
          user_name: o.user.name,
          user_login: o.user.login
        }
      })});
    });
  }
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to React</h1>
        </header>
        <p className="App-intro">
          <pre>
          {JSON.stringify(this.state, null, 2)}
          </pre>
        </p>
      </div>
    );
  }
}

export default App;
