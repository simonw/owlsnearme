import React, { Component } from 'react';
import './App.css';
import { get } from 'axios';
import { Map, TileLayer } from 'react-leaflet';

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
    const position = [this.state.lat, this.state.lng];
    return (
      <div className="App">
        <Map center={position} zoom={12}>
          <TileLayer
            attribution="&amp;copy <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <TileLayer
            attribution="<a href=&quot;https://www.inaturalist.org/&quot;>iNaturalist</a>"
            url="https://api.inaturalist.org/v1/colored_heatmap/{z}/{x}/{y}.png?taxon_id=19350"
          />
        </Map>
        <pre>
          {JSON.stringify(this.state, null, 2)}
        </pre>
      </div>
    );
  }
}

export default App;
