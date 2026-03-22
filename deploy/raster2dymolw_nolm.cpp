// Minimal DYMO LabelWriter converter without LanguageMonitor post-print polling.

#include <csignal>

#include "LabelWriterDriverV2.h"
#include "LabelWriterDriverInitializer.h"
#include "CupsFilter.h"
#include "DummyLanguageMonitor.h"

using namespace DymoPrinterDriver;

class CLabelWriterDriverInitializerNoLM {
public:
  static void ProcessCupsOptions(
    CLabelWriterDriverV2& Driver,
    CDummyLanguageMonitor&,
    int num_options,
    cups_option_t* options
  ) {
    CLabelWriterDriverInitializer::ProcessCupsOptions(Driver, num_options, options);
  }

  static void ProcessPageOptions(
    CLabelWriterDriverV2& Driver,
    CDummyLanguageMonitor&,
    cups_page_header2_t& PageHeader
  ) {
    CLabelWriterDriverInitializer::ProcessPageOptions(Driver, PageHeader);
  }
};

CCupsFilter<CLabelWriterDriverV2, CLabelWriterDriverInitializerNoLM, CDummyLanguageMonitor> gFilter;

int main(int argc, char* argv[]) {
  signal(SIGPIPE, SIG_IGN);

  auto signal_handler = [](int sig_num) {
    fprintf(stderr, "Received signal %d, aborting\n", sig_num);
    gFilter.Abort();
  };

  struct sigaction sa;
  sa.sa_handler = signal_handler;
  sa.sa_flags = SA_RESTART;

  sigemptyset(&sa.sa_mask);
  sigaddset(&sa.sa_mask, SIGHUP);
  sigaddset(&sa.sa_mask, SIGINT);
  sigaddset(&sa.sa_mask, SIGQUIT);
  sigaddset(&sa.sa_mask, SIGILL);
  sigaddset(&sa.sa_mask, SIGABRT);
  sigaddset(&sa.sa_mask, SIGSEGV);
  sigaddset(&sa.sa_mask, SIGTERM);
  sigaddset(&sa.sa_mask, SIGTSTP);

  sigaction(SIGHUP, &sa, nullptr);
  sigaction(SIGINT, &sa, nullptr);
  sigaction(SIGQUIT, &sa, nullptr);
  sigaction(SIGILL, &sa, nullptr);
  sigaction(SIGABRT, &sa, nullptr);
  sigaction(SIGSEGV, &sa, nullptr);
  sigaction(SIGTERM, &sa, nullptr);
  sigaction(SIGTSTP, &sa, nullptr);

  return gFilter.Run(argc, argv);
}
