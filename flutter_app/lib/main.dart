import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

const String _kGamesUrl = 'https://regardlessly.github.io/game-collection/';
const Color _kBrandBlue = Color(0xFF1155CC);
const Color _kLightGray = Color(0xFFEFEFEF);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));
  runApp(const CaritaHubGamesApp());
}

class CaritaHubGamesApp extends StatelessWidget {
  const CaritaHubGamesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CaritaHub Games',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: _kBrandBlue,
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        fontFamily: 'Helvetica Neue',
      ),
      home: const GameWebView(),
    );
  }
}

class GameWebView extends StatefulWidget {
  const GameWebView({super.key});

  @override
  State<GameWebView> createState() => _GameWebViewState();
}

class _GameWebViewState extends State<GameWebView> {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() { _isLoading = true; _hasError = false; });
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoading = false);
          },
          onWebResourceError: (WebResourceError error) {
            // Only flag errors on the main frame
            if ((error.isForMainFrame ?? true) && mounted) {
              setState(() { _isLoading = false; _hasError = true; });
            }
          },
        ),
      )
      ..loadRequest(Uri.parse(_kGamesUrl));
  }

  void _reload() {
    setState(() { _isLoading = true; _hasError = false; });
    _controller.reload();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvoked: (bool didPop) async {
        if (didPop) return;
        if (await _controller.canGoBack()) {
          await _controller.goBack();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Stack(
            children: [
              // ── WebView ──────────────────────────────────
              if (!_hasError)
                WebViewWidget(controller: _controller),

              // ── Loading spinner ───────────────────────────
              if (_isLoading && !_hasError)
                Container(
                  color: Colors.white,
                  child: const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(
                          color: _kBrandBlue,
                          strokeWidth: 3,
                        ),
                        SizedBox(height: 20),
                        Text(
                          'Loading games…',
                          style: TextStyle(
                            color: Color(0xFF555555),
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // ── Error / no-connection screen ──────────────
              if (_hasError)
                Container(
                  color: Colors.white,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 36),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 96,
                            height: 96,
                            decoration: BoxDecoration(
                              color: _kLightGray,
                              borderRadius: BorderRadius.circular(48),
                            ),
                            child: const Icon(
                              Icons.wifi_off_rounded,
                              size: 52,
                              color: Color(0xFF9ca3af),
                            ),
                          ),
                          const SizedBox(height: 28),
                          const Text(
                            'No connection',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF000000),
                            ),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Please check your internet connection\nand try again.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 16,
                              color: Color(0xFF555555),
                              height: 1.6,
                            ),
                          ),
                          const SizedBox(height: 36),
                          FilledButton(
                            onPressed: _reload,
                            style: FilledButton.styleFrom(
                              backgroundColor: _kBrandBlue,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 40, vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: const Text(
                              'Try again',
                              style: TextStyle(
                                  fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
