# A Place for the Shots

October 2026. Implemented with invented fixtures while I collect a real export.

Before I can ask which club is safer, I need to know that I have counted the
right shots. Importing the same session twice should not make a club look better
supported. A missing left/right measurement should not become a straight shot.
And a short mishit should stay in the picture.

I built a local import path around those requirements. I can preview a manual
CSV, see problems before it changes my history, and keep the original file next
to a private database. Repeated records are recognized by identity. Conflicting
records stop the import instead of silently replacing an earlier measurement.

The first audit shows observed carry ranges and sample support. It keeps sources,
shot intentions, and known adjustment settings separate. I can also see which
sessions have dates and which shots lack lateral measurements. None of those
counts establish that the data represents my future game yet.

The synthetic walkthrough includes a short mishit, missing lateral data, and
repeat imports. Automated tests check those cases along with unit conversion,
chronological ordering, and transaction failures. The next evidence I need is
one real export and a comparison between its displayed shots and the imported
records.

The [import guide](../data-import.md) explains the working commands and format.
Provider connectors, trained models, and recommendations still come later.
