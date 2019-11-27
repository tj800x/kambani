import { Component, OnInit } from '@angular/core';
import { DeviceDetectorService } from 'ngx-device-detector';
import { NgxSpinnerService } from 'ngx-spinner';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import { AppState } from 'src/app/core/store/app.state';
import { BaseComponent } from 'src/app/components/base.component';
import { DIDDocument } from 'src/app/core/interfaces/did-document';
import { DidKeyModel } from 'src/app/core/models/did-key.model';
import { DIDService } from 'src/app/core/services/did/did.service';
import { DialogsService } from 'src/app/core/services/dialogs/dialogs.service';
import { EntryType } from 'src/app/core/enums/entry-type';
import { ManagementKeyModel } from 'src/app/core/models/management-key.model';
import { ModalSizeTypes } from 'src/app/core/enums/modal-size-types';
import { PasswordDialogComponent } from 'src/app/components/dialogs/password/password.dialog.component';
import { ResultModel } from 'src/app/core/models/result.model';
import { SharedRoutes } from 'src/app/core/enums/shared-routes';
import { UpdateEntryDocument } from 'src/app/core/interfaces/update-entry-document';
import { VaultService } from 'src/app/core/services/vault/vault.service';
import { WorkflowService } from 'src/app/core/services/workflow/workflow.service';

@Component({
  selector: 'app-summary',
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss']
})
export class SummaryComponent extends BaseComponent implements OnInit {
  private subscription: Subscription;
  private didId: string;
  private didKeys: DidKeyModel[];
  private managementKeys: ManagementKeyModel[];
  public entry: DIDDocument | UpdateEntryDocument;
  public entryPretified: string;
  public recordOnChainButtonName = 'Record on-chain';
  
  constructor(
    private deviceService: DeviceDetectorService,
    private dialogsService: DialogsService,
    private didService: DIDService,
    private router: Router,
    private spinner: NgxSpinnerService,
    private store: Store<AppState>,
    private toastr: ToastrService,
    private vaultService: VaultService,
    private workflowService: WorkflowService) {
      super();
  }

  ngOnInit() {
    this.didId = this.didService.getId();

    this.subscription = this.store
      .pipe(select(state => state))
      .subscribe(state => {
        this.managementKeys = state.createDID.managementKeys;
        this.didKeys = state.createDID.didKeys;
      });

    this.subscriptions.push(this.subscription);

    if (this.deviceService.isMobile()) {
      this.recordOnChainButtonName = 'Record';
    }

    this.entry = this.didService.generateEntry(EntryType.CreateDIDEntry);
    this.entryPretified = JSON.stringify(this.entry, null, 2);
  }

  recordOnChain() {
    const dialogMessage = 'Enter your vault password to save your key(s)';

    this.dialogsService.open(PasswordDialogComponent, ModalSizeTypes.ExtraExtraLarge, dialogMessage)
      .subscribe((vaultPassword: string) => {
        if (vaultPassword) {
          this.spinner.show();
          this.vaultService
            .canDecryptVault(vaultPassword)
            .subscribe((result: ResultModel) => {
              if (result.success) {
                this.didService
                  .recordCreateEntryOnChain(this.entry as DIDDocument)
                  .subscribe((recordResult: any) => {
                    if (recordResult.error) {
                      this.spinner.hide();
                      this.toastr.error(recordResult.message);
                    } else {
                      this.vaultService
                        .saveDIDToVault(
                          this.didId,
                          this.entry as DIDDocument,
                          this.managementKeys,
                          this.didKeys,
                          vaultPassword)
                        .subscribe((result: ResultModel) => {
                          this.spinner.hide();

                          if (result.success) {
                            this.didService.clearData();
                            this.workflowService.moveToNextStep({ queryParams: { url: recordResult.url, didId: this.didId } });
                          } else {
                            /**
                            * this should never happen
                            */
                            this.toastr.error('A problem occurred! Please, try to create a new DID.');
                            this.router.navigate([SharedRoutes.ManageDids]);
                          }
                        });
                    }
                  });
              } else {
                this.spinner.hide();
                this.toastr.error(result.message);
              }
            });
        }
    });
  }

  goToPrevious() {
    this.workflowService.moveToPreviousStep();
  }
}
