Name:           fluxform
Version:        1.0.0
Release:        1%{?dist}
Summary:        Offline file converter for Linux desktops

License:        MIT
URL:            https://github.com/ishmweet/fluxform

Requires:       webkit2gtk4.1, ffmpeg, ImageMagick, pandoc, libreoffice

%description
FluxForm is a beautiful GNOME-style utility to convert
audio, video, images, documents, and archives offline.

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}%{_bindir}
mkdir -p %{buildroot}%{_datadir}/applications
mkdir -p %{buildroot}%{_datadir}/pixmaps

# These assume the build resources are in the sources directory during rpmbuild
cp %{_sourcedir}/fluxform %{buildroot}%{_bindir}/
cp %{_sourcedir}/fluxform.desktop %{buildroot}%{_datadir}/applications/
cp %{_sourcedir}/appicon.png %{buildroot}%{_datadir}/pixmaps/fluxform.png

%files
%{_bindir}/fluxform
%{_datadir}/applications/fluxform.desktop
%{_datadir}/pixmaps/fluxform.png

%changelog
* Sun Jun 28 2026 FluxForm Team - 1.0.0-1
- Initial release of FluxForm
