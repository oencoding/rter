angular.module('termview', [
	'ng',       //filers
	'ui',       //ui-sortable and map
	'items',    //ItemCache to load items into termview, various itemDialog services
	'taxonomy', //Rankings
	'alerts'    //Alerter
])

.factory('TermViewRemote', function () {
	function TermViewRemote() {
		this.termViews = [];

		this.addTermView = function(term) {
			for(var i = 0;i < this.termViews.length;i++) {
				if(this.termViews[i].term.Term == term.Term) {
					this.termViews[i].active = true;
					return;
				}
			}

			if(term.Term !== "") {
				this.termViews.push({term: term, heading: term.Term, active: true});
			} else {
				this.termViews.push({term: term, heading: "Live Feed", active: true});
			}
		};

		this.removeTermView = function(term) {
			for(var i = 0;i < this.termViews.length;i++) {
				if(this.termViews[i].term.Term == term.Term) {
					this.termViews.remove(i);
					return true;
				}
			}

			return false;
		};
	}

	return new TermViewRemote();
})

.controller('TermViewCtrl', function($scope, $filter, $timeout, Alerter, ItemCache, UpdateItemDialog, CloseupItemDialog, TermViewRemote, TaxonomyRankingCache) {

	$scope.viewmode = "map-view";
	$scope.filterMode = "remove";
	$scope.mapFilterEnable = false;

	$scope.$watch('mapFilterEnable', function() {
		$scope.boundsChanged();
	});

	$scope.$watch('viewmode', function(newVal, oldVal) {
		$scope.mapCenter = $scope.map.getCenter();

		$timeout(function() {
			$scope.resizeMap();
		}, 0);
	});

	/* -- items and rankings  -- */

	$scope.rankingCache = new TaxonomyRankingCache($scope.term.Term);

	$scope.$on("$destroy", function() {
		if($scope.rankingCache.close !== undefined) $scope.rankingCache.close();
	});

	if($scope.term.Term === "" || $scope.term.Term === undefined) {
		$scope.ranking = [];
	} else {
		$scope.ranking = $scope.rankingCache.ranking;
	}

	$scope.items = ItemCache.contents;

	$scope.filteredItems = $filter('filterByTerm')($scope.items, $scope.term.Term);
	$scope.orderedByID = $filter('orderBy')($scope.filteredItems, 'ID', true);
	$scope.orderedByTime = $filter('orderBy')($scope.orderedByID, 'StartTime', true);

	$scope.rankedItems = $filter('orderByRanking')($scope.orderedByTime, $scope.ranking);

	$scope.finalMapItems = $scope.rankedItems;
	$scope.finalFilteredItems = $scope.rankedItems;

	$scope.textSearchedItems = $filter('filter')($scope.rankedItems, $scope.filterQuery);
	$scope.mapFilteredItems = $filter('filterbyBounds')($scope.textSearchedItems, $scope.mapBounds);

	$scope.$watch('items', function() {
		$scope.filteredItems = $filter('filterByTerm')($scope.items, $scope.term.Term);
		$scope.orderedByID = $filter('orderBy')($scope.filteredItems, 'ID', true);
		$scope.orderedByTime = $filter('orderBy')($scope.orderedByID, 'StartTime', true);
	}, true);

	$scope.$watch('[ranking, orderedByTime]', function() {
		$scope.rankedItems = $filter('orderByRanking')($scope.orderedByTime, $scope.ranking);
	}, true);

	$scope.$watch('[rankedItems, filterMode]', function() {
		if($scope.filterMode == 'blur') {
			$scope.finalFilteredItems = $scope.rankedItems;
			// $scope.finalMapItems = $scope.rankedItems;
		}
	}, true);

	$scope.$watch('[rankedItems, textQuery, filterMode]', function() {
		// if($scope.filterMode == 'remove') {
			$scope.textSearchedItems = $filter('filter')($scope.rankedItems, $scope.textQuery);
		// }
	}, true);

	$scope.$watch('[textSearchedItems, filterMode]', function() {
		// if($scope.filterMode == 'remove') {
			$scope.finalMapItems = $scope.textSearchedItems;
		// }
	}, true);

	$scope.$watch('finalMapItems', function() {
		$scope.updateMarkers();
	}, true);

	$scope.$watch('[textSearchedItems, mapBounds, mapFilterEnable, filterMode]', function() {
		if($scope.filterMode == 'remove') {
			if($scope.mapFilterEnable) {
				$scope.mapFilteredItems = $filter('filterbyBounds')($scope.textSearchedItems, $scope.mapBounds);
			} else {
				$scope.mapFilteredItems = $scope.textSearchedItems;
			}
		}
	}, true);

	$scope.$watch('[mapFilteredItems, filterMode]', function() {
		if($scope.filterMode == 'remove') {
			$scope.finalFilteredItems = $scope.mapFilteredItems;
		}
	}, true);

	$scope.isFiltered = function(item) {
		var filtered = [item];

		filtered = $filter('filter')(filtered, $scope.textQuery);

		if($scope.mapFilterEnable) {
			filtered = $filter('filterbyBounds')(filtered, $scope.mapBounds);
		}

		if(filtered.length === 0) return true;
		else return false;
	};

	$scope.dragFreeze = false; //FIXME: Hack to fix drag bug with firefox http://forum.jquery.com/topic/jquery-ui-sortable-triggers-a-click-in-firefox-15

	$scope.dragCallback = function(e) {		
		if($scope.filterMode == 'remove' && ($scope.mapFilterEnable || ($scope.textQuery !== undefined && $scope.textQuery !== ''))) { //TODO: This should have a blur options instead maybe?
			Alerter.warn("You cannot reorder items while your filters are enabled", 2000);
			return;
		}

		var newRanking = [];
		angular.forEach($scope.rankedItems, function(v) {
			newRanking.push(v.ID);
		});

		if($scope.term.Term !== "" && $scope.term.Term !== undefined) {
			$scope.rankingCache.update(newRanking);
		}

		$scope.dragFreeze = true; //FIXME: Hack to fix drag bug with firefox http://forum.jquery.com/topic/jquery-ui-sortable-triggers-a-click-in-firefox-15

		$timeout(function() { //FIXME: Hack to fix drag bug with firefox http://forum.jquery.com/topic/jquery-ui-sortable-triggers-a-click-in-firefox-15
			$scope.dragFreeze = false;
		}, 50);
	};

	$scope.closeupItemDialog = function(item) {
		if($scope.dragFreeze) return; //FIXME: Hack to fix drag bug with firefox http://forum.jquery.com/topic/jquery-ui-sortable-triggers-a-click-in-firefox-15

		CloseupItemDialog.open(item);
	};

	$scope.updateItemDialog = function(item) {
		if($scope.dragFreeze) return; //FIXME: Hack to fix drag bug with firefox http://forum.jquery.com/topic/jquery-ui-sortable-triggers-a-click-in-firefox-15

		UpdateItemDialog.open(item).then(function() {
			$scope.updateMarkers();
		});
	};

	$scope.close = function() {
		TermViewRemote.removeTermView($scope.term);
	};

	/* -- Map -- */

	$scope.boundsChanged = function() {
		$scope.mapBounds = $scope.map.getBounds();
	};

	$scope.markerBundles = [];

	$scope.mapCenter = new google.maps.LatLng(45.50745, -73.5793);

	$scope.mapOptions = {
		center: $scope.mapCenter,
		zoom: 18,
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};

	$scope.resizeMap = function() {
		google.maps.event.trigger($scope.map, "resize");
		$scope.map.setCenter($scope.mapCenter);
		$scope.mapBounds = $scope.map.getBounds();
	};

	$scope.updateMarkers = function() {
		angular.forEach($scope.markerBundles, function(v) {
			v.marker.setMap(null);
		});

		$scope.markerBundles = [];

		angular.forEach($scope.finalMapItems, function(v) {
			if(v.Lat === undefined || v.Lng === undefined || (v.Lat === 0 && v.Lng === 0)) return;

			var m = new google.maps.Marker({
				map: $scope.map,
				position: new google.maps.LatLng(v.Lat, v.Lng)
			});

			//m.setIcon(new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_xpin_icon&chld=pin_sleft|glyphish_runner", null, null, null, new google.maps.Size(40, 40)));

			if(v.Type == "streaming-video-v1" && v.Live === true) {
				m.setIcon("http://maps.google.com/mapfiles/ms/icons/yellow-dot.png");
			}
			else if(v.Type == "breadcrumb") {
				m.setIcon("http://rter.cim.mcgill.ca/asset/small_blue.png");
			}

			/*
			if(v.ThumbnailURI !== undefined && v.ThumbnailURI !== "") {
				m.setIcon(new google.maps.MarkerImage(v.ThumbnailURI, null, null, null, new google.maps.Size(40, 40)));
			}
			*/

			$scope.markerBundles.push({marker: m, item: v});
		});
	};

	$scope.centerAt = function(location) {
		var latlng = new google.maps.LatLng(location.coords.latitude, location.coords.longitude);
		$scope.map.setCenter(latlng);
		$scope.mapCenter = latlng;
	};

	var map_dropdown = $("body #map_dropdown");

	$scope.showMapMenu = function($event, $params) {
		$(".context-dropdown").hide();
		map_dropdown.css({
			display: "block",
			left: $event.pixel.x,
			top: $event.pixel.y
		});

		$scope.beacon = {
			Lat: $event.latLng.lat(),
			Lng: $event.latLng.lng()
		};

		$(document).one("click", function() {
			$scope.beacon = {};
			map_dropdown.hide();
			return false;
		});

		return false;
	};

	$scope.createBeacon = function() {
		$scope.beacon.Type = "beacon";
		$scope.beacon.HasGeo = true;
		$scope.beacon.StartTime = new Date();
		$scope.beacon.StopTime = $scope.beacon.StartTime;

		$scope.inProgress = true;

		ItemCache.create(
			$scope.beacon,
			function() {
				$scope.inProgress = false;
			},
			function() {
				$scope.inProgress = false;
			}
		);
		$scope.beacon = {};
	};

	var marker_dropdown = $("body #marker_dropdown");

	function geoToOffset(latLng) {
		var topRight = $scope.map.getProjection().fromLatLngToPoint($scope.map.getBounds().getNorthEast()); 
		var bottomLeft = $scope.map.getProjection().fromLatLngToPoint($scope.map.getBounds().getSouthWest()); 
		var scale = Math.pow(2, $scope.map.getZoom()); 
		var worldPoint = $scope.map.getProjection().fromLatLngToPoint(latLng); 
		return new google.maps.Point((worldPoint.x - bottomLeft.x) * scale,(worldPoint.y - topRight.y) * scale); 
	};

	$scope.showMarkerMenu = function($event, $params, bundle) {
		$(".context-dropdown").hide();
		console.log($event);
		console.log(bundle);
		var offset = geoToOffset(bundle.marker.getPosition());

		marker_dropdown.css({
			display: "block",
			left: offset.x,
			top: offset.y - 20
		});

		$scope.beacon = bundle.item;

		$(document).one("click", function() {
			$scope.beacon = {};
			marker_dropdown.hide();
			return false;
		});
		return false;
	};

	$scope.deleteBeacon = function() {
		$scope.inProgress = true;

		ItemCache.remove(
			$scope.beacon,
			function() {
				$scope.inProgress = false;
			},
			function() {
				$scope.inProgress = false;
			}
		);

		$scope.beacon = {};
	};

	$scope.sendBroadcast = function(msg) {
		$scope.broadcast.Type = "message:" + $scope.broadcast.message;
		$scope.broadcast.StartTime = new Date();
		$scope.broadcast.StopTime = $scope.broadcast.StartTime;

		$scope.inProgress = true;

		ItemCache.create(
			$scope.broadcast,
			function() {
				$scope.inProgress = false;
			},
			function() {
				$scope.inProgress = false;
			}
		);
		$scope.broadcast = {};
	};

})

.directive('termview', function() {
	return {
		restrict: 'E',
		scope: {
			term: "="
		},
		templateUrl: '/template/termview/termview.html',
		controller: 'TermViewCtrl',
		link: function(scope, element, attrs) {
			navigator.geolocation.getCurrentPosition(scope.centerAt);
		}
	};
});

