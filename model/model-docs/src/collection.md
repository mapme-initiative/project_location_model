# Collecting Project Locations

## What shall be collected? 
*A project location is defined as a set of one or more spatial features that are part of a financially supported activity where it is not feasible to make any further geographical distinctions regarding funding.* 

The responsible party shall gather all project locations that received financial support within the context of a specific cooperation project. Project locations are generally to be collected on the **output level**. Nonetheless, if geospatial data can also contribute to the measurement of project outcomes and impacts, then location data for potential outcome sites shall be submitted as well. 

Examples: 

1. A project financially supports the construction of a hospital. The hospital has a specific location with a single feature (point) which indicates the spatial location of the hospital (=output). Project outcomes are to be measured using non-geospatial data (e.g. patient statistics), hence no further submission of project locations is necessary. 
2. A project financially supports the construction of an irrigation infrastructure that benefits a group of small-scale farmers. The irrigation infrastructure (=output) is composed of different features (e.g. irrigation channels and small dams) that are to be mapped individually. Furthermore, remote sensing data is considered to measure project outcomes (e.g. by quantifying changes in agricultural productivity). In this case geospatial information on outcome areas shall be submitted as well, i.e. the agricultural plots that make use of and benefit from the irrigation infrastructure.

The current model version (still) differentiates between **mandatory and non-mandatory fields**. You can get information whether a certain field is mandatory in the field descriptions (see Annex 1 and 2).  

## Time of Data Collection
KfW strongly encourages the PEA or consultant to collect geo-coordinates **as early as possible** to increase the utilization potential of such data throughout the entire project cycle. If possible, data should be collected already during the project preparation phase, e.g. as part of a feasibility study. Data can later be updated if a project location site changes. Data updates should be performed, ideally, on an annual base with the usual progress reports, if not speficied differently. 

## Geographical exactness, geometry and aggregation 
In the sense of the IATI standard, a project location can be either **exact** or **approximate**. Exact locations refer to the geographical endpoints of financial flows. They are reported with exact coordinates. It is also possible to report project locations as "approximate" if the exact location of the project implementation site is yet unknown or should be anonymized e.g. for security reasons. An appropriate form of reporting an approximate location could be the use the administrative area where the project is supposed to be implemented. 

Project locations can have three different **geometry types**:
- **Point geometry**, e.g. a well or a hospital.
- **Line geometry**, e.g. a road or transmission line.
- **Polygon geometry**, e.g. a protected area, agricultural plot or administrative unit.

In addition different levels of detail may be used to represent this information. A road can be segmented into different road sections if different measures have been financed in the individual sections. Furthermore, locations might be **aggregated** in a polygon that represents an intervention area or administrative unit. This might be appropriate if there is a very large number of small sites, if the exact locations are yet unknown or if they should not be revealed due to privacy or security concerns. 

There are no hard, determinisitic rules for choosing an adequate geometry type and aggregation level for the data collection. However, the following principles should be applied by the responsible party: 
- *Maximize transparency and preciceness* of financial flows. 
- Allow for *precise and unambigous spatial identification and delination* of project locations and different supported activities. 
- *Preserve data privacy:* data should not be collected on an aggregation level where it contains personal information or could lead to the identification of individuals. 
- *Avoid security risks*: data should not be collected on an aggregation level that might expose or endanger vulnerable groups such as refugees or minorities that might face discrimination. 
- Follow a reasonable *cost-benefit ratio* for collecting and producing the required information. 

In case you are unsure, please get in touch with your project partner to discuss the necessary details. 

## Collection of point-locations using Excel
For the collection of point-loctions we currently accept submissions in the **.XLSX** and **.GeoJSON** format.   
 
 The **.XLSX** format is best suited, if your institution does not know how to handle geospatial data and has no former expirience with GIS software. In this case you can use our [Excel Templates](./xlsx.md) to collect all relevant information including geographic coordinates to be put into the Latitude and Longitude columns.
 
 The **GeoJSON** format is preffered for its reliability and flexibility . It is also capable of handling line- and polygon geometries. More information on its usage is given in the next section below. 

## Collection of point-, line-, and polygon-locations using GIS software
For the collection of line- or polygon-locations you shall use the **.GeoJSON** format. For point-locations  this is optional, but preffered. We highlight two common cases for generating the required data: 

 1. **Desktop-production**: For a manual data collection we recommend to use our [Excel Templates](./xlsx.md) to collect all attribute information in Excel and then merge this information with the spatial information (feature geometries) in a GIS software. Because our Excel Templates are pre-configured, it is easier to provide data that is compliant with out [data-model](./json.md) and pass our [validation check](./validation.md). You can see a short [Video Tutorial](www.youtube.com) that shows you how to do this using Excel and the QGIS software.
 2. **Database-extraction**: If you already have  location information in a geospatial database you may want to extract and transform that information in a way that matches our requirements. In this case you can use the data-model provided as a [JSON Schema](./json.md) to extract the data from your DB and convert it  creating appropriate field-mappings. This comes in handy for batch-conversions but you may need to (manually) add missing information. 

If using GeoJSON format, multi-point, -line or -polygon features can be submitted as well to reduce redundancy for data inputs. This can be usefull if the same project activity benefits multiple sites (e.g. all agricultural plots that benefit from one irrigation infrastructure). 




